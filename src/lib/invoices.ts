import { prisma } from "@/lib/prisma";
import {
  normalizeProviderId,
  sendInvoiceViaProvider,
  splitGross,
} from "@/lib/invoice-providers";
import type { ProviderInvoiceInput } from "@/lib/invoice-providers/types";

function orgToProvider(org: {
  afm: string | null;
  taxMode: string;
  mydataUserId: string | null;
  mydataSubscriptionKey: string | null;
  mydataBranch: number;
  invoiceProvider: string;
  invoiceProviderApiKey: string | null;
  invoiceProviderOrgId: string | null;
  invoiceProviderBaseUrl: string | null;
  invoiceProviderMeta: string | null;
}) {
  return {
    afm: org.afm,
    taxMode: org.taxMode,
    mydataUserId: org.mydataUserId,
    mydataSubscriptionKey: org.mydataSubscriptionKey,
    mydataBranch: org.mydataBranch,
    invoiceProvider: org.invoiceProvider,
    invoiceProviderApiKey: org.invoiceProviderApiKey,
    invoiceProviderOrgId: org.invoiceProviderOrgId,
    invoiceProviderBaseUrl: org.invoiceProviderBaseUrl,
    invoiceProviderMeta: org.invoiceProviderMeta,
  };
}

function statusFromResult(ok: boolean, taxMode: string, provider: string) {
  if (!ok) return "FAILED" as const;
  if (normalizeProviderId(provider) === "AADE" && taxMode === "offline") {
    return "OFFLINE" as const;
  }
  return "SENT" as const;
}

/** Έκδοση ΑΠΥ/παραστατικού για κράτηση + διαβίβαση μέσω παροχού. */
export async function issueInvoiceForBooking(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: true,
      vehicle: true,
      organization: true,
      invoices: true,
    },
  });
  if (!booking) throw new Error("NOT_FOUND");

  const success = booking.invoices.find(
    (i) => i.mydataStatus === "SENT" || i.mydataStatus === "OFFLINE"
  );
  if (success) {
    return { skipped: true as const, invoice: success };
  }

  const failed = booking.invoices.find((i) => i.mydataStatus === "FAILED");
  if (failed) {
    return retryInvoice(failed.id);
  }

  const org = booking.organization;
  const aa = org.nextInvoiceAa;
  const series = org.invoiceSeries || "RF";
  const vatCategory = org.vatCategory || 1;
  const { net, vat } = splitGross(booking.totalAmount, vatCategory);
  const customerName = `${booking.customer.firstName} ${booking.customer.lastName}`;
  const description = `Ενοικίαση ${booking.vehicle?.plateNumber || "οχήματος"} · ${booking.code || booking.id}`;

  const input: ProviderInvoiceInput = {
    series,
    aa,
    issueDate: new Date(),
    invoiceType: "11.2",
    vatCategory,
    grossAmount: booking.totalAmount,
    netAmount: net,
    vatAmount: vat,
    description,
    customerName,
    customerEmail: booking.customer.email,
    customerAfm: booking.customer.afm,
    customerIsForeign: booking.customer.isForeign,
    bookingCode: booking.code,
    plateNumber: booking.vehicle?.plateNumber,
  };

  const result = await sendInvoiceViaProvider(orgToProvider(org), input);
  const mydataStatus = statusFromResult(
    result.ok,
    org.taxMode,
    org.invoiceProvider
  );

  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        number: `${series}-${aa}`,
        series,
        aa,
        customerName,
        amount: booking.totalAmount,
        netAmount: net,
        vat,
        vatCategory,
        invoiceType: "11.2",
        mydataStatus,
        mydataUid: result.uid || result.externalId || null,
        mydataMark: result.mark || null,
        qrUrl: result.qrUrl || null,
        xmlPayload: result.xml || null,
        responseXml: result.rawResponse || null,
        errorMessage: result.error || null,
        bookingId: booking.id,
        organizationId: org.id,
      },
    });
    await tx.organization.update({
      where: { id: org.id },
      data: { nextInvoiceAa: aa + 1 },
    });
    await tx.booking.update({
      where: { id: booking.id },
      data: {
        mydataStatus: result.ok ? "OK" : "FAILED",
      },
    });
    return inv;
  });

  return { skipped: false as const, invoice, result };
}

/** Επανυποβολή FAILED παραστατικού — ίδιο ΑΑ, χωρίς νέο αριθμό */
export async function retryInvoice(invoiceId: string, organizationId?: string) {
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      ...(organizationId ? { organizationId } : {}),
    },
    include: {
      organization: true,
      booking: {
        include: { vehicle: true, customer: true },
      },
    },
  });
  if (!invoice) throw new Error("NOT_FOUND");
  if (invoice.mydataStatus === "SENT" || invoice.mydataStatus === "OFFLINE") {
    return { skipped: true as const, invoice };
  }
  if (invoice.mydataStatus !== "FAILED" && invoice.mydataStatus !== "DRAFT") {
    throw new Error("NOT_RETRYABLE");
  }

  const org = invoice.organization;
  const description = invoice.booking
    ? `Ενοικίαση ${invoice.booking.vehicle?.plateNumber || "οχήματος"} · ${invoice.booking.code || invoice.bookingId}`
    : `Παραστατικό ${invoice.number}`;

  const input: ProviderInvoiceInput = {
    series: invoice.series,
    aa: invoice.aa,
    issueDate: invoice.issuedAt,
    invoiceType: invoice.invoiceType || "11.2",
    vatCategory: invoice.vatCategory,
    grossAmount: invoice.amount,
    netAmount: invoice.netAmount,
    vatAmount: invoice.vat,
    description,
    customerName: invoice.customerName,
    customerEmail: invoice.booking?.customer?.email,
    customerAfm: invoice.booking?.customer?.afm,
    customerIsForeign: invoice.booking?.customer?.isForeign,
    bookingCode: invoice.booking?.code,
    plateNumber: invoice.booking?.vehicle?.plateNumber,
  };

  const result = await sendInvoiceViaProvider(orgToProvider(org), input);
  const mydataStatus = statusFromResult(
    result.ok,
    org.taxMode,
    org.invoiceProvider
  );

  const updated = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        mydataStatus,
        mydataUid: result.uid || result.externalId || invoice.mydataUid,
        mydataMark: result.mark || invoice.mydataMark,
        qrUrl: result.qrUrl || invoice.qrUrl,
        xmlPayload: result.xml || invoice.xmlPayload,
        responseXml: result.rawResponse,
        errorMessage: result.error || null,
      },
    });
    if (invoice.bookingId) {
      await tx.booking.update({
        where: { id: invoice.bookingId },
        data: { mydataStatus: result.ok ? "OK" : "FAILED" },
      });
    }
    return inv;
  });

  return { skipped: false as const, invoice: updated, result };
}
