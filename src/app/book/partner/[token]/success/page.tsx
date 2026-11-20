import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { ConfirmPaymentClient } from "@/components/confirm-payment-client";
import { loadPartnerByPublicToken } from "@/lib/partners";

export default async function PartnerBookSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ booking?: string; session_id?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  if (!sp.booking) notFound();

  const partner = await loadPartnerByPublicToken(token);
  if (!partner?.organization?.publicToken) notFound();

  const orgToken = partner.organization.publicToken;

  const booking = await prisma.booking.findFirst({
    where: {
      id: sp.booking,
      organizationId: partner.organizationId,
      partnerAgreementId: partner.id,
    },
    include: {
      customer: true,
      vehicle: true,
      organization: { select: { name: true } },
      partnerAgreement: { select: { name: true } },
    },
  });
  if (!booking) notFound();

  const agreementUrl = `/api/public/booking/${booking.id}/agreement-pdf?token=${encodeURIComponent(orgToken)}`;
  const licenseUrl = booking.licenseScanCreatedAt
    ? `/api/public/booking/${booking.id}/license-scan?token=${encodeURIComponent(orgToken)}`
    : null;

  return (
    <div className="min-h-screen bg-background">
      <main className="page-shell flex max-w-lg flex-col py-16">
        <p className="text-sm text-muted">{booking.organization.name}</p>
        <h1 className="font-display mt-2 text-3xl">Ευχαριστούμε!</h1>
        <p className="mt-2 text-muted">
          Η κράτησή σου καταχωρήθηκε
          {booking.paymentStatus === "PAID" ? " και πληρώθηκε" : ""}
          {booking.partnerAgreement
            ? ` μέσω «${booking.partnerAgreement.name}»`
            : ""}
          .
        </p>

        <Card className="mt-8 space-y-2 text-sm">
          <p>
            <span className="text-muted">Κωδικός:</span>{" "}
            <strong>{booking.code}</strong>
          </p>
          <p>
            <span className="text-muted">Όνομα:</span>{" "}
            {booking.customer.firstName} {booking.customer.lastName}
          </p>
          <p>
            <span className="text-muted">Όχημα:</span>{" "}
            {booking.vehicle
              ? `${booking.vehicle.make} ${booking.vehicle.model}`
              : "—"}
          </p>
          <p>
            <span className="text-muted">Παραλαβή:</span>{" "}
            {formatDateTime(booking.pickupAt)}
          </p>
          <p>
            <span className="text-muted">Επιστροφή:</span>{" "}
            {formatDateTime(booking.returnAt)}
          </p>
          <p>
            <span className="text-muted">Ποσό:</span>{" "}
            {formatCurrency(booking.totalAmount)} · {booking.paymentStatus}
          </p>
        </Card>

        <Card className="mt-4 space-y-3">
          <h2 className="font-display text-lg">Τα έγγραφά σου</h2>
          <p className="text-xs text-muted">
            Μπορείς να ανοίξεις ή να κατεβάσεις τα PDF της κράτησης.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={agreementUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-dark"
            >
              Μισθωτήριο PDF
            </a>
            {licenseUrl ? (
              <a
                href={licenseUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-slate-50"
              >
                Άδεια οδήγησης PDF
              </a>
            ) : null}
          </div>
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-medium text-muted">Μισθωτήριο</p>
              <iframe
                title="Μισθωτήριο"
                src={agreementUrl}
                className="h-72 w-full rounded-md border border-border bg-white"
              />
            </div>
            {licenseUrl ? (
              <div>
                <p className="mb-1 text-xs font-medium text-muted">
                  Σάρωση άδειας
                </p>
                <iframe
                  title="Άδεια οδήγησης"
                  src={licenseUrl}
                  className="h-72 w-full rounded-md border border-border bg-white"
                />
              </div>
            ) : null}
          </div>
        </Card>

        {sp.session_id && booking.paymentStatus !== "PAID" ? (
          <ConfirmPaymentClient
            bookingId={booking.id}
            token={orgToken}
            sessionId={sp.session_id}
          />
        ) : null}

        <Link
          href={`/book/partner/${token}`}
          className="mt-8 text-sm text-accent hover:underline"
        >
          Νέα κράτηση
        </Link>
      </main>
    </div>
  );
}
