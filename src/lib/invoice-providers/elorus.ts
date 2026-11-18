import { openSecret } from "@/lib/secret-box";
import type {
  InvoiceProviderOrg,
  ProviderInvoiceInput,
  ProviderSendResult,
} from "@/lib/invoice-providers/types";

type ElorusMeta = {
  documentTypeId?: string;
  taxId?: string;
  mydataDocumentType?: string;
  mydataClassificationCategory?: string;
  mydataClassificationType?: string;
};

function parseMeta(raw?: string | null): ElorusMeta {
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw) as ElorusMeta;
  } catch {
    return {};
  }
}

function authHeaders(org: InvoiceProviderOrg) {
  const apiKey = openSecret(org.invoiceProviderApiKey) || "";
  const orgId = org.invoiceProviderOrgId?.trim() || "";
  return {
    apiKey,
    orgId,
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Elorus-Organization": orgId,
    } as Record<string, string>,
  };
}

/** Έλεγχος σύνδεσης Elorus (λίστα contacts / me). */
export async function testElorusConnection(
  org: InvoiceProviderOrg
): Promise<{ ok: boolean; message: string }> {
  const { apiKey, orgId, headers } = authHeaders(org);
  if (!apiKey || !orgId) {
    return {
      ok: false,
      message: "Λείπουν API key ή Organization ID του Elorus",
    };
  }
  try {
    const res = await fetch("https://api.elorus.com/v1.2/contacts/?page_size=1", {
      method: "GET",
      headers,
    });
    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        message: `Elorus ${res.status}: ${text.slice(0, 180)}`,
      };
    }
    return { ok: true, message: "Σύνδεση Elorus OK" };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Αποτυχία σύνδεσης Elorus",
    };
  }
}

async function findOrCreateContact(
  headers: Record<string, string>,
  input: ProviderInvoiceInput
): Promise<{ id: string | null; error?: string }> {
  const email = input.customerEmail?.trim();
  if (email) {
    const q = new URL(
      "https://api.elorus.com/v1.2/contacts/"
    );
    q.searchParams.set("search", email);
    q.searchParams.set("page_size", "1");
    const res = await fetch(q.toString(), { headers });
    if (res.ok) {
      const data = (await res.json()) as {
        results?: { id?: string | number; email?: string }[];
      };
      const hit = data.results?.[0];
      if (hit?.id != null) return { id: String(hit.id) };
    }
  }

  const createRes = await fetch("https://api.elorus.com/v1.2/contacts/", {
    method: "POST",
    headers,
    body: JSON.stringify({
      first_name: input.customerName.split(/\s+/)[0] || input.customerName,
      last_name:
        input.customerName.split(/\s+/).slice(1).join(" ") || input.customerName,
      email: email || undefined,
      is_client: true,
      vat_number: input.customerAfm || undefined,
      display_name: input.customerName,
    }),
  });
  const createText = await createRes.text();
  if (!createRes.ok) {
    return {
      id: null,
      error: `Elorus contact ${createRes.status}: ${createText.slice(0, 200)}`,
    };
  }
  try {
    const created = JSON.parse(createText) as { id?: string | number };
    return { id: created.id != null ? String(created.id) : null };
  } catch {
    return { id: null, error: "Elorus: μη έγκυρη απάντηση επαφής" };
  }
}

/** Έκδοση παραστατικού μέσω Elorus (ο παροχός στέλνει στο myDATA). */
export async function sendViaElorus(
  org: InvoiceProviderOrg,
  input: ProviderInvoiceInput
): Promise<ProviderSendResult> {
  const { apiKey, orgId, headers } = authHeaders(org);
  if (!apiKey || !orgId) {
    return {
      ok: false,
      provider: "ELORUS",
      error: "Δεν έχουν ρυθμιστεί credentials Elorus",
    };
  }

  const meta = parseMeta(org.invoiceProviderMeta);
  const contact = await findOrCreateContact(headers, input);
  if (!contact.id) {
    return {
      ok: false,
      provider: "ELORUS",
      error: contact.error || "Αποτυχία δημιουργίας επαφής Elorus",
    };
  }

  const item: Record<string, unknown> = {
    title: input.description,
    quantity: "1",
    unit_total: String(input.grossAmount.toFixed(2)),
    mydata_classification_category:
      meta.mydataClassificationCategory || "category1_3",
    mydata_classification_type: meta.mydataClassificationType || "E3_561_001",
  };
  if (meta.taxId) item.taxes = [meta.taxId];

  const payload: Record<string, unknown> = {
    date: input.issueDate.toISOString().slice(0, 10),
    client: contact.id,
    client_display_name: input.customerName,
    client_email: input.customerEmail || undefined,
    currency_code: "EUR",
    calculator_mode: "total",
    draft: false,
    mydata_document_type: meta.mydataDocumentType || input.invoiceType || "11.2",
    items: [item],
    public_notes: input.bookingCode
      ? `Κράτηση ${input.bookingCode}${
          input.plateNumber ? ` · ${input.plateNumber}` : ""
        }`
      : undefined,
    paid_on_receipt: String(input.grossAmount.toFixed(2)),
    payment_method: "3",
  };
  if (meta.documentTypeId) payload.documenttype = meta.documentTypeId;

  try {
    const res = await fetch("https://api.elorus.com/v1.2/invoices/", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        provider: "ELORUS",
        error: `Elorus invoice ${res.status}: ${text.slice(0, 280)}`,
        rawResponse: text.slice(0, 4000),
      };
    }
    let parsed: {
      id?: string | number;
      number?: string;
      mydata_uid?: string;
      mydata_mark?: string;
      permalink?: string;
      url?: string;
    } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      /* ignore */
    }
    return {
      ok: true,
      provider: "ELORUS",
      externalId: parsed.id != null ? String(parsed.id) : undefined,
      uid: parsed.mydata_uid || (parsed.number ? String(parsed.number) : undefined),
      mark: parsed.mydata_mark,
      qrUrl: parsed.permalink || parsed.url,
      rawResponse: text.slice(0, 4000),
    };
  } catch (e) {
    return {
      ok: false,
      provider: "ELORUS",
      error: e instanceof Error ? e.message : "Elorus network error",
    };
  }
}
