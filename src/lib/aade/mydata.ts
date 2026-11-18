/**
 * myDATA REST API client (ΑΑΔΕ) — ίδια προσέγγιση με Katalima.
 * Docs: https://www.aade.gr
 *
 * Dev:  https://mydataapidev.aade.gr/SendInvoices
 * Prod: https://mydatapi.aade.gr/myDATA/SendInvoices
 */

import { isValidAfm } from "@/lib/aade/afm";
import { openSecret } from "@/lib/secret-box";

export type MyDataMode = "offline" | "sandbox" | "live";

export type MyDataConfig = {
  mode: MyDataMode;
  userId: string;
  subscriptionKey: string;
  afm: string;
  branch: number;
};

export type InvoiceBuildInput = {
  afm: string;
  branch: number;
  series: string;
  aa: number;
  issueDate: Date;
  invoiceType?: string;
  vatCategory: number;
  grossAmount: number;
  description: string;
};

export type MyDataSendResult = {
  ok: boolean;
  mode: MyDataMode;
  xml: string;
  statusCode?: string;
  uid?: string;
  mark?: string;
  qrUrl?: string;
  error?: string;
  rawResponse?: string;
  endpoint?: string;
};

/** Parse ΑΑΔΕ ResponseDoc XML (SendInvoices). */
export function parseMyDataResponse(xml: string): {
  ok: boolean;
  statusCode?: string;
  uid?: string;
  mark?: string;
  qrUrl?: string;
  error?: string;
} {
  if (!xml?.trim()) {
    return { ok: false, error: "Κενή απάντηση myDATA" };
  }

  const pick = (tag: string) => {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
    const m = xml.match(re);
    return m?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
  };

  const statusCode = pick("statusCode");
  const uid = pick("invoiceUid") || pick("uid");
  const mark = pick("invoiceMark") || pick("mark");
  const qrUrl = pick("qrUrl") || pick("authenticationCode");
  const errorMsg =
    pick("message") || pick("errorMessage") || pick("errors");

  const ok =
    Boolean(statusCode && /^success$/i.test(statusCode)) ||
    Boolean(uid && mark);

  return {
    ok,
    statusCode,
    uid,
    mark,
    qrUrl: qrUrl?.startsWith("http") ? qrUrl : undefined,
    error: ok
      ? undefined
      : errorMsg ||
        (statusCode ? `myDATA: ${statusCode}` : "Αποτυχία διαβίβασης myDATA"),
  };
}

const VAT_RATES: Record<number, number> = {
  1: 0.24,
  2: 0.13,
  3: 0.06,
  8: 0,
};

export function vatRate(category: number) {
  return VAT_RATES[category] ?? 0.24;
}

export function splitGross(gross: number, vatCategory: number) {
  const rate = vatRate(vatCategory);
  const net = rate === 0 ? gross : gross / (1 + rate);
  const vat = gross - net;
  return {
    net: Math.round(net * 100) / 100,
    vat: Math.round(vat * 100) / 100,
  };
}

export function resolveMyDataConfig(org: {
  taxMode?: string | null;
  mydataUserId?: string | null;
  mydataSubscriptionKey?: string | null;
  afm?: string | null;
  mydataBranch?: number | null;
}): MyDataConfig {
  const mode = (org.taxMode || process.env.MYDATA_MODE || "offline") as MyDataMode;
  return {
    mode: ["offline", "sandbox", "live"].includes(mode) ? mode : "offline",
    userId: org.mydataUserId || process.env.MYDATA_USER_ID || "",
    subscriptionKey:
      openSecret(org.mydataSubscriptionKey) ||
      process.env.MYDATA_SUBSCRIPTION_KEY ||
      "",
    afm: org.afm || process.env.MYDATA_AFM || "",
    branch: org.mydataBranch ?? Number(process.env.MYDATA_BRANCH || 0),
  };
}

export function buildInvoiceXml(input: InvoiceBuildInput): string {
  const { net, vat } = splitGross(input.grossAmount, input.vatCategory);
  const date = input.issueDate.toISOString().slice(0, 10);
  const type = input.invoiceType || "11.2";
  return `<?xml version="1.0" encoding="UTF-8"?>
<InvoicesDoc xmlns="http://www.aade.gr/myDATA/invoice/v1.0">
  <invoice>
    <issuer>
      <vatNumber>${input.afm}</vatNumber>
      <country>GR</country>
      <branch>${input.branch}</branch>
    </issuer>
    <invoiceHeader>
      <series>${input.series}</series>
      <aa>${input.aa}</aa>
      <issueDate>${date}</issueDate>
      <invoiceType>${type}</invoiceType>
      <currency>EUR</currency>
    </invoiceHeader>
    <invoiceDetails>
      <lineNumber>1</lineNumber>
      <netValue>${net.toFixed(2)}</netValue>
      <vatCategory>${input.vatCategory}</vatCategory>
      <vatAmount>${vat.toFixed(2)}</vatAmount>
    </invoiceDetails>
    <invoiceSummary>
      <totalNetValue>${net.toFixed(2)}</totalNetValue>
      <totalVatAmount>${vat.toFixed(2)}</totalVatAmount>
      <totalGrossValue>${input.grossAmount.toFixed(2)}</totalGrossValue>
    </invoiceSummary>
  </invoice>
</InvoicesDoc>`;
}

export async function sendInvoice(
  config: MyDataConfig,
  input: InvoiceBuildInput
): Promise<MyDataSendResult> {
  const xml = buildInvoiceXml(input);

  if (config.mode === "offline") {
    return {
      ok: true,
      mode: "offline",
      xml,
      uid: `OFFLINE-${input.series}-${input.aa}`,
      mark: String(Date.now()),
    };
  }

  if (!isValidAfm(config.afm)) {
    return { ok: false, mode: config.mode, xml, error: "Μη έγκυρο ΑΦΜ εκδότη" };
  }
  if (!config.userId || !config.subscriptionKey) {
    return {
      ok: false,
      mode: config.mode,
      xml,
      error: "Λείπουν myDATA credentials",
    };
  }

  const endpoint =
    config.mode === "live"
      ? "https://mydatapi.aade.gr/myDATA/SendInvoices"
      : "https://mydataapidev.aade.gr/SendInvoices";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/xml",
        "aade-user-id": config.userId,
        "ocp-apim-subscription-key": config.subscriptionKey,
      },
      body: xml,
    });
    const rawResponse = await res.text();
    const parsed = parseMyDataResponse(rawResponse);
    const ok = res.ok && parsed.ok;
    return {
      ok,
      mode: config.mode,
      xml,
      rawResponse,
      endpoint,
      statusCode: parsed.statusCode,
      uid: parsed.uid || (ok ? `LIVE-${input.series}-${input.aa}` : undefined),
      mark: parsed.mark,
      qrUrl: parsed.qrUrl,
      error: ok
        ? undefined
        : parsed.error || (!res.ok ? `HTTP ${res.status}` : "Αποτυχία myDATA"),
    };
  } catch (e) {
    return {
      ok: false,
      mode: config.mode,
      xml,
      endpoint,
      error: e instanceof Error ? e.message : "Σφάλμα δικτύου myDATA",
    };
  }
}
