import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { sealSecret, maskSecret } from "@/lib/secret-box";
import { canManageSettings } from "@/lib/permissions";
import {
  INVOICE_PROVIDERS,
  getInvoiceProvider,
  isKnownInvoiceProvider,
  normalizeProviderId,
  providerLabel,
  testInvoiceProvider,
} from "@/lib/invoice-providers";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
  });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const provider = normalizeProviderId(org.invoiceProvider);
  const def = getInvoiceProvider(provider);
  return NextResponse.json({
    afm: org.afm,
    doy: org.doy,
    pytLicense: org.pytLicense,
    taxMode: org.taxMode,
    clientLedgerMode: org.clientLedgerMode,
    mydataUserId: org.mydataUserId,
    mydataSubscriptionKeyMasked: maskSecret(org.mydataSubscriptionKey),
    mydataBranch: org.mydataBranch,
    invoiceSeries: org.invoiceSeries,
    nextInvoiceAa: org.nextInvoiceAa,
    vatCategory: org.vatCategory,
    invoiceProvider: provider,
    invoiceProviderLabel: providerLabel(provider),
    invoiceProviderApiKeyMasked: maskSecret(org.invoiceProviderApiKey),
    invoiceProviderOrgId: org.invoiceProviderOrgId || "",
    invoiceProviderBaseUrl: org.invoiceProviderBaseUrl || "",
    invoiceProviderMeta: org.invoiceProviderMeta || "",
    hasInvoiceProviderKey: Boolean(org.invoiceProviderApiKey),
    invoiceProviderDef: {
      id: def.id,
      name: def.name,
      company: def.company,
      integration: def.integration,
      needsApiKey: Boolean(def.needsApiKey),
      needsOrgId: Boolean(def.needsOrgId),
      needsBaseUrl: Boolean(def.needsBaseUrl),
      needsMeta: Boolean(def.needsMeta),
      needsMydataCreds: Boolean(def.needsMydataCreds),
      docsUrl: def.docsUrl || null,
    },
    invoiceProviders: INVOICE_PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      company: p.company,
      aadeCode: p.aadeCode || null,
      integration: p.integration,
      needsApiKey: Boolean(p.needsApiKey),
      needsOrgId: Boolean(p.needsOrgId),
      needsBaseUrl: Boolean(p.needsBaseUrl),
      needsMeta: Boolean(p.needsMeta),
      needsMydataCreds: Boolean(p.needsMydataCreds),
    })),
  });
}

const schema = z.object({
  afm: z.string().optional().nullable(),
  doy: z.string().optional().nullable(),
  pytLicense: z.string().optional().nullable(),
  taxMode: z.enum(["offline", "sandbox", "live"]).optional(),
  clientLedgerMode: z.enum(["offline", "sandbox", "live"]).optional(),
  mydataUserId: z.string().optional().nullable(),
  mydataSubscriptionKey: z.string().optional().nullable(),
  mydataBranch: z.coerce.number().int().min(0).optional(),
  invoiceSeries: z.string().min(1).max(10).optional(),
  vatCategory: z.coerce.number().int().min(1).max(8).optional(),
  invoiceProvider: z
    .string()
    .max(40)
    .refine((v) => isKnownInvoiceProvider(v), "Άγνωστος πάροχος")
    .optional(),
  invoiceProviderApiKey: z.string().optional().nullable(),
  invoiceProviderOrgId: z.string().optional().nullable(),
  invoiceProviderBaseUrl: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .nullable(),
  invoiceProviderMeta: z.string().max(4000).optional().nullable(),
  testConnection: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageSettings(session)) {
    return NextResponse.json({ error: "Μόνο διαχειριστής" }, { status: 403 });
  }

  try {
    const body = schema.parse(await req.json());
    const data: Record<string, unknown> = {};
    if (body.afm !== undefined) data.afm = body.afm || null;
    if (body.doy !== undefined) data.doy = body.doy || null;
    if (body.pytLicense !== undefined) data.pytLicense = body.pytLicense || null;
    if (body.taxMode) data.taxMode = body.taxMode;
    if (body.clientLedgerMode) data.clientLedgerMode = body.clientLedgerMode;
    if (body.mydataUserId !== undefined) data.mydataUserId = body.mydataUserId || null;
    if (body.mydataSubscriptionKey?.trim()) {
      data.mydataSubscriptionKey = sealSecret(body.mydataSubscriptionKey.trim());
    }
    if (body.mydataBranch !== undefined) data.mydataBranch = body.mydataBranch;
    if (body.invoiceSeries) data.invoiceSeries = body.invoiceSeries;
    if (body.vatCategory) data.vatCategory = body.vatCategory;
    if (body.invoiceProvider) data.invoiceProvider = body.invoiceProvider;
    if (body.invoiceProviderApiKey?.trim()) {
      data.invoiceProviderApiKey = sealSecret(body.invoiceProviderApiKey.trim());
    }
    if (body.invoiceProviderOrgId !== undefined) {
      data.invoiceProviderOrgId = body.invoiceProviderOrgId?.trim() || null;
    }
    if (body.invoiceProviderBaseUrl !== undefined) {
      data.invoiceProviderBaseUrl = body.invoiceProviderBaseUrl?.trim() || null;
    }
    if (body.invoiceProviderMeta !== undefined) {
      data.invoiceProviderMeta = body.invoiceProviderMeta?.trim() || null;
    }

    const org = await prisma.organization.update({
      where: { id: session.organizationId },
      data,
    });

    let test: { ok: boolean; message: string; provider: string } | undefined;
    if (body.testConnection) {
      test = await testInvoiceProvider({
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
      });
    }

    return NextResponse.json({ ok: true, test });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Μη έγκυρα στοιχεία" }, { status: 400 });
    }
    return NextResponse.json({ error: "Μη έγκυρα στοιχεία" }, { status: 400 });
  }
}
