import { openSecret } from "@/lib/secret-box";
import type {
  InvoiceProviderOrg,
  ProviderInvoiceInput,
  ProviderSendResult,
} from "@/lib/invoice-providers/types";

/** Generic webhook πάροχου: POST JSON στο base URL. */
export async function sendViaCustom(
  org: InvoiceProviderOrg,
  input: ProviderInvoiceInput
): Promise<ProviderSendResult> {
  const url = org.invoiceProviderBaseUrl?.trim();
  if (!url) {
    return {
      ok: false,
      provider: "CUSTOM",
      error: "Λείπει το Base URL του παροχού",
    };
  }
  const apiKey = openSecret(org.invoiceProviderApiKey) || "";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...(org.invoiceProviderOrgId
          ? { "X-Organization-Id": org.invoiceProviderOrgId }
          : {}),
      },
      body: JSON.stringify({
        provider: org.invoiceProvider,
        series: input.series,
        aa: input.aa,
        issueDate: input.issueDate.toISOString(),
        invoiceType: input.invoiceType,
        vatCategory: input.vatCategory,
        grossAmount: input.grossAmount,
        netAmount: input.netAmount,
        vatAmount: input.vatAmount,
        description: input.description,
        customer: {
          name: input.customerName,
          email: input.customerEmail,
          afm: input.customerAfm,
          isForeign: input.customerIsForeign,
        },
        bookingCode: input.bookingCode,
        plateNumber: input.plateNumber,
        meta: org.invoiceProviderMeta
          ? (() => {
              try {
                return JSON.parse(org.invoiceProviderMeta);
              } catch {
                return org.invoiceProviderMeta;
              }
            })()
          : undefined,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        provider: "CUSTOM",
        error: `Provider ${res.status}: ${text.slice(0, 280)}`,
        rawResponse: text.slice(0, 4000),
      };
    }
    let parsed: {
      ok?: boolean;
      uid?: string;
      mark?: string;
      qrUrl?: string;
      id?: string;
      error?: string;
    } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      /* plain OK */
    }
    if (parsed.ok === false) {
      return {
        ok: false,
        provider: "CUSTOM",
        error: parsed.error || "Ο παροχός απέρριψε το παραστατικό",
        rawResponse: text.slice(0, 4000),
      };
    }
    return {
      ok: true,
      provider: "CUSTOM",
      uid: parsed.uid,
      mark: parsed.mark,
      qrUrl: parsed.qrUrl,
      externalId: parsed.id,
      rawResponse: text.slice(0, 4000),
    };
  } catch (e) {
    return {
      ok: false,
      provider: "CUSTOM",
      error: e instanceof Error ? e.message : "Custom provider network error",
    };
  }
}

export async function testCustomConnection(
  org: InvoiceProviderOrg
): Promise<{ ok: boolean; message: string }> {
  const url = org.invoiceProviderBaseUrl?.trim();
  if (!url) {
    return { ok: false, message: "Λείπει το Base URL" };
  }
  try {
    const apiKey = openSecret(org.invoiceProviderApiKey) || "";
    const res = await fetch(url, {
      method: "OPTIONS",
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    });
    // Πολλοί webhook δεν υποστηρίζουν OPTIONS — θεωρούμε OK αν δεν είναι 401/403
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: `Απόρριψη auth (${res.status})` };
    }
    return {
      ok: true,
      message: `URL προσβάσιμο (HTTP ${res.status})`,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Αποτυχία σύνδεσης",
    };
  }
}
