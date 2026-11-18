import {
  resolveMyDataConfig,
  sendInvoice,
  splitGross,
} from "@/lib/aade/mydata";
import { sendViaElorus, testElorusConnection } from "@/lib/invoice-providers/elorus";
import {
  sendViaCustom,
  testCustomConnection,
} from "@/lib/invoice-providers/custom";
import {
  getInvoiceProvider,
  isKnownInvoiceProvider,
  providerOptionLabel,
  INVOICE_PROVIDERS,
} from "@/lib/invoice-providers/catalog";
import type {
  InvoiceProviderId,
  InvoiceProviderOrg,
  ProviderInvoiceInput,
  ProviderSendResult,
} from "@/lib/invoice-providers/types";

export type { InvoiceProviderId, ProviderInvoiceInput, ProviderSendResult };
export {
  INVOICE_PROVIDERS,
  getInvoiceProvider,
  isKnownInvoiceProvider,
  providerOptionLabel,
};

export function normalizeProviderId(raw?: string | null): InvoiceProviderId {
  const id = (raw || "AADE").toUpperCase();
  return isKnownInvoiceProvider(id) ? id : "AADE";
}

export function providerLabel(id: InvoiceProviderId) {
  const def = getInvoiceProvider(id);
  return providerOptionLabel(def);
}

export async function testInvoiceProvider(
  org: InvoiceProviderOrg
): Promise<{ ok: boolean; message: string; provider: InvoiceProviderId }> {
  const provider = normalizeProviderId(org.invoiceProvider);
  const def = getInvoiceProvider(provider);

  if (def.integration === "elorus") {
    const r = await testElorusConnection(org);
    return { ...r, provider };
  }

  if (def.integration === "api") {
    if (def.needsBaseUrl && !org.invoiceProviderBaseUrl?.trim()) {
      return {
        ok: false,
        provider,
        message: `Για ${def.name} χρειάζεται API/Webhook URL από τον πάροχο`,
      };
    }
    if (def.needsApiKey && !org.invoiceProviderApiKey) {
      return {
        ok: false,
        provider,
        message: `Για ${def.name} χρειάζεται API key`,
      };
    }
    if (def.needsOrgId && !org.invoiceProviderOrgId?.trim()) {
      return {
        ok: false,
        provider,
        message: `Για ${def.name} χρειάζεται Organization / λογαριασμός ID`,
      };
    }
    if (!org.invoiceProviderBaseUrl?.trim()) {
      return {
        ok: true,
        provider,
        message: `${def.name}: credentials ορισμένα — συμπλήρωσε Base URL όταν ο πάροχος σου δώσει endpoint`,
      };
    }
    const r = await testCustomConnection(org);
    return { ...r, provider };
  }

  const cfg = resolveMyDataConfig(org);
  if (cfg.mode === "offline") {
    return {
      ok: true,
      provider,
      message: "AADE offline — δεν απαιτείται live σύνδεση",
    };
  }
  if (!cfg.userId || !cfg.subscriptionKey) {
    return {
      ok: false,
      provider,
      message: "Λείπουν myDATA user id / subscription key",
    };
  }
  return {
    ok: true,
    provider,
    message: `AADE ${cfg.mode} — credentials ορισμένα`,
  };
}

/** Διαβίβαση παραστατικού στον επιλεγμένο παροχό. */
export async function sendInvoiceViaProvider(
  org: InvoiceProviderOrg,
  input: ProviderInvoiceInput
): Promise<ProviderSendResult> {
  const provider = normalizeProviderId(org.invoiceProvider);
  const def = getInvoiceProvider(provider);

  if (def.integration === "elorus") {
    return sendViaElorus(org, input);
  }

  if (def.integration === "api") {
    const result = await sendViaCustom(org, input);
    return {
      ...result,
      provider,
      error: result.error
        ? `[${def.name}] ${result.error}`
        : result.error,
    };
  }

  const config = resolveMyDataConfig(org);
  const result = await sendInvoice(config, {
    afm: config.afm || org.afm || "000000000",
    branch: config.branch,
    series: input.series,
    aa: input.aa,
    issueDate: input.issueDate,
    invoiceType: input.invoiceType,
    vatCategory: input.vatCategory,
    grossAmount: input.grossAmount,
    description: input.description,
  });

  return {
    ok: result.ok,
    provider: "AADE",
    uid: result.uid,
    mark: result.mark,
    qrUrl: result.qrUrl,
    xml: result.xml,
    rawResponse: result.rawResponse,
    error: result.error,
  };
}

export { splitGross };
