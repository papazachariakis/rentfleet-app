"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Label } from "@/components/ui";

type ProviderOption = {
  id: string;
  name: string;
  company: string;
  aadeCode: string | null;
  integration: string;
  needsApiKey: boolean;
  needsOrgId: boolean;
  needsBaseUrl: boolean;
  needsMeta: boolean;
  needsMydataCreds: boolean;
};

type FormState = {
  afm: string;
  doy: string;
  pytLicense: string;
  taxMode: string;
  clientLedgerMode: string;
  mydataUserId: string;
  mydataSubscriptionKey: string;
  mydataBranch: string;
  invoiceSeries: string;
  vatCategory: string;
  mydataSubscriptionKeyMasked: string;
  invoiceProvider: string;
  invoiceProviderApiKey: string;
  invoiceProviderApiKeyMasked: string;
  invoiceProviderOrgId: string;
  invoiceProviderBaseUrl: string;
  invoiceProviderMeta: string;
};

const empty: FormState = {
  afm: "",
  doy: "",
  pytLicense: "",
  taxMode: "offline",
  clientLedgerMode: "offline",
  mydataUserId: "",
  mydataSubscriptionKey: "",
  mydataBranch: "0",
  invoiceSeries: "RF",
  vatCategory: "1",
  mydataSubscriptionKeyMasked: "",
  invoiceProvider: "AADE",
  invoiceProviderApiKey: "",
  invoiceProviderApiKeyMasked: "",
  invoiceProviderOrgId: "",
  invoiceProviderBaseUrl: "",
  invoiceProviderMeta: "",
};

export function TaxSettingsForm() {
  const [form, setForm] = useState<FormState>(empty);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [filter, setFilter] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/tax/settings")
      .then((r) => r.json())
      .then((d) => {
        setProviders(d.invoiceProviders || []);
        setForm((f) => ({
          ...f,
          afm: d.afm || "",
          doy: d.doy || "",
          pytLicense: d.pytLicense || "",
          taxMode: d.taxMode || "offline",
          clientLedgerMode: d.clientLedgerMode || "offline",
          mydataUserId: d.mydataUserId || "",
          mydataBranch: String(d.mydataBranch ?? 0),
          invoiceSeries: d.invoiceSeries || "RF",
          vatCategory: String(d.vatCategory ?? 1),
          mydataSubscriptionKeyMasked: d.mydataSubscriptionKeyMasked || "",
          invoiceProvider: d.invoiceProvider || "AADE",
          invoiceProviderApiKeyMasked: d.invoiceProviderApiKeyMasked || "",
          invoiceProviderOrgId: d.invoiceProviderOrgId || "",
          invoiceProviderBaseUrl: d.invoiceProviderBaseUrl || "",
          invoiceProviderMeta: d.invoiceProviderMeta || "",
        }));
      });
  }, []);

  const selected = useMemo(
    () => providers.find((p) => p.id === form.invoiceProvider) || null,
    [providers, form.invoiceProvider]
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.company.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.aadeCode || "").includes(q)
    );
  }, [providers, filter]);

  async function save(e: React.FormEvent, testConnection = false) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    const res = await fetch("/api/tax/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        afm: form.afm,
        doy: form.doy,
        pytLicense: form.pytLicense,
        taxMode: form.taxMode,
        clientLedgerMode: form.clientLedgerMode,
        mydataUserId: form.mydataUserId,
        mydataSubscriptionKey: form.mydataSubscriptionKey || undefined,
        mydataBranch: Number(form.mydataBranch),
        invoiceSeries: form.invoiceSeries,
        vatCategory: Number(form.vatCategory),
        invoiceProvider: form.invoiceProvider,
        invoiceProviderApiKey: form.invoiceProviderApiKey || undefined,
        invoiceProviderOrgId: form.invoiceProviderOrgId,
        invoiceProviderBaseUrl: form.invoiceProviderBaseUrl || "",
        invoiceProviderMeta: form.invoiceProviderMeta,
        testConnection,
      }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error || "Αποτυχία αποθήκευσης");
      return;
    }
    setForm((f) => ({
      ...f,
      mydataSubscriptionKey: "",
      invoiceProviderApiKey: "",
    }));
    if (data.test) {
      setMsg(
        data.test.ok
          ? `Αποθηκεύτηκε · ${data.test.message}`
          : `Αποθηκεύτηκε · Έλεγχος: ${data.test.message}`
      );
    } else {
      setMsg("Αποθηκεύτηκε");
    }
  }

  const showProviderCreds =
    selected &&
    (selected.needsApiKey ||
      selected.needsOrgId ||
      selected.needsBaseUrl ||
      selected.needsMeta);

  return (
    <Card>
      <h2 className="font-display text-lg">Ρυθμίσεις ΑΑΔΕ & πάροχος</h2>
      <form
        onSubmit={(e) => save(e, false)}
        className="mt-4 grid gap-3 sm:grid-cols-2"
      >
        <div className="sm:col-span-2 space-y-3 rounded-lg border border-border bg-slate-50 p-3">
          <div>
            <Label>Πάροχος ηλεκτρονικής τιμολόγησης</Label>
            <p className="mt-1 text-xs text-muted">
              Επίσημη λίστα αδειών ΑΑΔΕ (ΥΠΑΗΕΣ) — κάθε πελάτης επιλέγει τον
              πάροχό του.{" "}
              <a
                href="https://www.aade.gr/mydata/adeiodotimena-logismika-parohon-ilektronikis-timologisis"
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                Πίνακας ΑΑΔΕ
              </a>
            </p>
          </div>
          <div>
            <Label>Αναζήτηση</Label>
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="π.χ. SoftOne, Elorus, IMPACT, 032…"
            />
          </div>
          <div>
            <Label>Επιλογή παρόχου ({filtered.length})</Label>
            <select
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
              value={form.invoiceProvider}
              onChange={(e) =>
                setForm((f) => ({ ...f, invoiceProvider: e.target.value }))
              }
              size={Math.min(12, Math.max(6, filtered.length))}
            >
              {filtered.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.aadeCode ? ` · ${p.aadeCode}` : ""} — {p.company}
                </option>
              ))}
            </select>
          </div>
          {selected ? (
            <p className="text-xs text-muted">
              Επιλεγμένο: <strong className="text-foreground">{selected.name}</strong>{" "}
              ({selected.company}
              {selected.aadeCode ? ` · κωδ. ${selected.aadeCode}` : ""})
            </p>
          ) : null}
        </div>

        {showProviderCreds ? (
          <>
            {selected?.needsApiKey ? (
              <div>
                <Label>API key παρόχου</Label>
                <Input
                  type="password"
                  value={form.invoiceProviderApiKey}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      invoiceProviderApiKey: e.target.value,
                    }))
                  }
                  placeholder={
                    form.invoiceProviderApiKeyMasked || "νέο API key…"
                  }
                />
              </div>
            ) : null}
            {selected?.needsOrgId ? (
              <div>
                <Label>Organization / λογαριασμός ID</Label>
                <Input
                  value={form.invoiceProviderOrgId}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      invoiceProviderOrgId: e.target.value,
                    }))
                  }
                />
              </div>
            ) : null}
            {selected?.needsBaseUrl ? (
              <div className="sm:col-span-2">
                <Label>API / Webhook URL</Label>
                <Input
                  value={form.invoiceProviderBaseUrl}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      invoiceProviderBaseUrl: e.target.value,
                    }))
                  }
                  placeholder="https://… (endpoint έκδοσης παραστατικού)"
                />
                <p className="mt-1 text-xs text-muted">
                  Ζήτησε από τον πάροχο το REST endpoint έκδοσης τιμολογίου.
                  Στο Elorus δεν χρειάζεται (έχει ενσωματωμένο API).
                </p>
              </div>
            ) : null}
            {selected?.needsMeta ? (
              <div className="sm:col-span-2">
                <Label>Extra ρυθμίσεις (JSON, προαιρετικό)</Label>
                <Input
                  value={form.invoiceProviderMeta}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      invoiceProviderMeta: e.target.value,
                    }))
                  }
                  placeholder='{"documentTypeId":"…","taxId":"…"}'
                />
              </div>
            ) : null}
          </>
        ) : null}

        <div>
          <Label>ΑΦΜ</Label>
          <Input
            value={form.afm}
            onChange={(e) => setForm((f) => ({ ...f, afm: e.target.value }))}
          />
        </div>
        <div>
          <Label>ΔΟΥ</Label>
          <Input
            value={form.doy}
            onChange={(e) => setForm((f) => ({ ...f, doy: e.target.value }))}
          />
        </div>
        <div>
          <Label>Άδεια ΠΥΤ</Label>
          <Input
            value={form.pytLicense}
            onChange={(e) =>
              setForm((f) => ({ ...f, pytLicense: e.target.value }))
            }
          />
        </div>
        <div>
          <Label>Σειρά παραστατικών</Label>
          <Input
            value={form.invoiceSeries}
            onChange={(e) =>
              setForm((f) => ({ ...f, invoiceSeries: e.target.value }))
            }
          />
        </div>
        <div>
          <Label>myDATA mode</Label>
          <select
            className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
            value={form.taxMode}
            onChange={(e) =>
              setForm((f) => ({ ...f, taxMode: e.target.value }))
            }
          >
            <option value="offline">offline</option>
            <option value="sandbox">sandbox</option>
            <option value="live">live</option>
          </select>
        </div>
        <div>
          <Label>Πελατολόγιο mode</Label>
          <select
            className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
            value={form.clientLedgerMode}
            onChange={(e) =>
              setForm((f) => ({ ...f, clientLedgerMode: e.target.value }))
            }
          >
            <option value="offline">offline</option>
            <option value="sandbox">sandbox</option>
            <option value="live">live</option>
          </select>
        </div>

        {selected?.needsMydataCreds || form.invoiceProvider === "AADE" ? (
          <>
            <div>
              <Label>myDATA user id</Label>
              <Input
                value={form.mydataUserId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, mydataUserId: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>myDATA subscription key</Label>
              <Input
                type="password"
                value={form.mydataSubscriptionKey}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    mydataSubscriptionKey: e.target.value,
                  }))
                }
                placeholder={form.mydataSubscriptionKeyMasked || "νέο key…"}
              />
            </div>
            <div>
              <Label>myDATA branch</Label>
              <Input
                type="number"
                min={0}
                value={form.mydataBranch}
                onChange={(e) =>
                  setForm((f) => ({ ...f, mydataBranch: e.target.value }))
                }
              />
            </div>
          </>
        ) : null}

        <div>
          <Label>ΦΠΑ κατηγορία</Label>
          <select
            className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
            value={form.vatCategory}
            onChange={(e) =>
              setForm((f) => ({ ...f, vatCategory: e.target.value }))
            }
          >
            <option value="1">1 — 24%</option>
            <option value="2">2 — 13%</option>
            <option value="3">3 — 6%</option>
            <option value="8">8 — 0%</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Αποθήκευση…" : "Αποθήκευση"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={(e) => save(e, true)}
          >
            Αποθήκευση & έλεγχος σύνδεσης
          </Button>
          {msg ? (
            <span className="self-center text-sm text-muted">{msg}</span>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
