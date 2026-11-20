"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Input, Label } from "@/components/ui";
import {
  compareCategoryNames,
  formatCurrency,
  partnerKindLabel,
} from "@/lib/utils";

type Category = {
  id: string;
  name: string;
  vehicleType: string;
  baseDailyRate: number;
  depositAmount: number;
};

type PartnerRate = {
  categoryId: string;
  dailyRate: number;
  depositAmount?: number | null;
  category?: Category | null;
};

type Agreement = {
  id: string;
  name: string;
  kind: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  publicToken: string;
  active: boolean;
  validFrom: string | null;
  validTo: string | null;
  discountPercent: number | null;
  rates: PartnerRate[];
  _count?: { bookings: number };
};

type RateDraft = Record<string, { dailyRate: string; depositAmount: string }>;

function emptyRates(categories: Category[]): RateDraft {
  const out: RateDraft = {};
  for (const c of categories) {
    out[c.id] = {
      dailyRate: String(c.baseDailyRate ?? 40),
      depositAmount: String(c.depositAmount ?? 300),
    };
  }
  return out;
}

export function PartnersManager() {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    kind: "BROKER",
    contactName: "",
    phone: "",
    email: "",
    notes: "",
    active: true,
    validFrom: "",
    validTo: "",
    discountPercent: "",
  });
  const [rates, setRates] = useState<RateDraft>({});

  const sortedCategories = useMemo(
    () =>
      [...categories].sort((a, b) => compareCategoryNames(a.name, b.name)),
    [categories]
  );

  async function load() {
    const res = await fetch("/api/partners");
    const data = await res.json().catch(() => ({}));
    setAgreements(data.agreements || []);
    setCategories(data.categories || []);
    if (!editingId) setRates(emptyRates(data.categories || []));
  }

  useEffect(() => {
    void load();
  }, []);

  function startCreate() {
    setEditingId(null);
    setForm({
      name: "",
      kind: "BROKER",
      contactName: "",
      phone: "",
      email: "",
      notes: "",
      active: true,
      validFrom: "",
      validTo: "",
      discountPercent: "",
    });
    setRates(emptyRates(categories));
    setMsg("");
  }

  function startEdit(a: Agreement) {
    setEditingId(a.id);
    setForm({
      name: a.name,
      kind: a.kind || "BROKER",
      contactName: a.contactName || "",
      phone: a.phone || "",
      email: a.email || "",
      notes: a.notes || "",
      active: a.active,
      validFrom: a.validFrom ? a.validFrom.slice(0, 10) : "",
      validTo: a.validTo ? a.validTo.slice(0, 10) : "",
      discountPercent:
        a.discountPercent != null ? String(a.discountPercent) : "",
    });
    const draft = emptyRates(categories);
    for (const r of a.rates || []) {
      draft[r.categoryId] = {
        dailyRate: String(r.dailyRate),
        depositAmount:
          r.depositAmount != null
            ? String(r.depositAmount)
            : draft[r.categoryId]?.depositAmount || "300",
      };
    }
    setRates(draft);
    setMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function ratesPayload() {
    return sortedCategories
      .map((c) => {
        const r = rates[c.id];
        const dailyRate = Number(r?.dailyRate);
        if (!r || !Number.isFinite(dailyRate) || dailyRate <= 0) return null;
        const deposit = Number(r.depositAmount);
        return {
          categoryId: c.id,
          dailyRate,
          depositAmount: Number.isFinite(deposit) ? deposit : null,
        };
      })
      .filter(Boolean);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    const payload = {
      name: form.name,
      kind: form.kind,
      contactName: form.contactName || null,
      phone: form.phone || null,
      email: form.email || null,
      notes: form.notes || null,
      active: form.active,
      validFrom: form.validFrom || null,
      validTo: form.validTo || null,
      discountPercent: form.discountPercent
        ? Number(form.discountPercent)
        : null,
      rates: ratesPayload(),
    };
    const res = await fetch(
      editingId ? `/api/partners/${editingId}` : "/api/partners",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMsg(data.error || "Αποτυχία");
      return;
    }
    setMsg(editingId ? "Η συμφωνία ενημερώθηκε" : "Η συμφωνία δημιουργήθηκε");
    startCreate();
    await load();
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Διαγραφή / απενεργοποίηση «${name}»;`)) return;
    const res = await fetch(`/api/partners/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error || "Αποτυχία");
      return;
    }
    setMsg(data.message || "ΟΚ");
    if (editingId === id) startCreate();
    await load();
  }

  async function copyLink(token: string) {
    const url = `${window.location.origin}/book/partner/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setMsg("Το link αντιγράφηκε");
    } catch {
      setMsg(url);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg">
              {editingId ? "Διόρθωση συμφωνίας" : "Νέα συμφωνία"}
            </h2>
            {editingId ? (
              <button
                type="button"
                className="text-sm text-accent hover:underline"
                onClick={startCreate}
              >
                Νέα
              </button>
            ) : null}
          </div>
          <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Όνομα</Label>
              <Input
                required
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Hotel Poseidon / Broker Athens"
              />
            </div>
            <div>
              <Label>Τύπος</Label>
              <select
                className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
                value={form.kind}
                onChange={(e) =>
                  setForm((f) => ({ ...f, kind: e.target.value }))
                }
              >
                <option value="BROKER">Broker</option>
                <option value="HOTEL">Ξενοδοχείο</option>
                <option value="OTHER">Άλλο</option>
              </select>
            </div>
            <div>
              <Label>Έκπτωση % (αν λείπει τιμή κατηγορίας)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={form.discountPercent}
                onChange={(e) =>
                  setForm((f) => ({ ...f, discountPercent: e.target.value }))
                }
                placeholder="π.χ. 15"
              />
            </div>
            <div>
              <Label>Επαφή</Label>
              <Input
                value={form.contactName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contactName: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Τηλέφωνο</Label>
              <Input
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Ισχύει από</Label>
              <Input
                type="date"
                value={form.validFrom}
                onChange={(e) =>
                  setForm((f) => ({ ...f, validFrom: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Ισχύει έως</Label>
              <Input
                type="date"
                value={form.validTo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, validTo: e.target.value }))
                }
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Σημειώσεις</Label>
              <Input
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm((f) => ({ ...f, active: e.target.checked }))
                }
              />
              Ενεργή συμφωνία
            </label>

            <div className="sm:col-span-2">
              <h3 className="font-display text-base">Τιμοκατάλογος ανά κατηγορία</h3>
              <p className="mt-1 text-xs text-muted">
                Προσυμπληρωμένο από λιανικές τιμές — άλλαξέ τες για αυτή τη
                συμφωνία.
              </p>
              <div className="mt-3 space-y-2">
                {sortedCategories.map((c) => (
                  <div
                    key={c.id}
                    className="grid grid-cols-[1fr_100px_100px] items-end gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-[11px] text-muted">
                        Λιανικό {formatCurrency(c.baseDailyRate)}/ημ
                      </p>
                    </div>
                    <div>
                      <Label>€/ημέρα</Label>
                      <Input
                        type="number"
                        min={1}
                        step={0.01}
                        required
                        value={rates[c.id]?.dailyRate || ""}
                        onChange={(e) =>
                          setRates((r) => ({
                            ...r,
                            [c.id]: {
                              dailyRate: e.target.value,
                              depositAmount:
                                r[c.id]?.depositAmount ||
                                String(c.depositAmount),
                            },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>Εγγύηση</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={rates[c.id]?.depositAmount || ""}
                        onChange={(e) =>
                          setRates((r) => ({
                            ...r,
                            [c.id]: {
                              dailyRate:
                                r[c.id]?.dailyRate ||
                                String(c.baseDailyRate),
                              depositAmount: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>
                ))}
                {sortedCategories.length === 0 ? (
                  <p className="text-sm text-muted">
                    Πρόσθεσε πρώτα κατηγορίες στο /fleet
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" disabled={loading}>
                {editingId ? "Αποθήκευση" : "Δημιουργία συμφωνίας"}
              </Button>
              {editingId ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={startCreate}
                  disabled={loading}
                >
                  Ακύρωση
                </Button>
              ) : null}
            </div>
          </form>
        </Card>

        <Card>
          <h2 className="font-display text-lg">Συμφωνίες</h2>
          <p className="mt-1 text-sm text-muted">
            Κάθε συμφωνία έχει δικό της τιμοκατάλογο και ιδιωτικό booking link.
          </p>
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
            {agreements.map((a) => (
              <li key={a.id} className="px-3 py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {a.name}{" "}
                      <span className="font-normal text-muted">
                        · {partnerKindLabel(a.kind)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {a.rates?.length || 0} τιμές ·{" "}
                      {a._count?.bookings || 0} κρατήσεις
                      {a.discountPercent != null
                        ? ` · έκπτωση ${a.discountPercent}%`
                        : ""}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge tone={a.active ? "success" : "warning"}>
                        {a.active ? "Ενεργή" : "Ανενεργή"}
                      </Badge>
                      <button
                        type="button"
                        className="text-xs text-accent hover:underline"
                        onClick={() => copyLink(a.publicToken)}
                      >
                        Αντιγραφή link
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <button
                      type="button"
                      className="text-accent hover:underline"
                      onClick={() => startEdit(a)}
                    >
                      Διόρθωση
                    </button>
                    <button
                      type="button"
                      className="text-danger hover:underline"
                      onClick={() => remove(a.id, a.name)}
                    >
                      Διαγραφή
                    </button>
                  </div>
                </div>
              </li>
            ))}
            {agreements.length === 0 ? (
              <li className="px-3 py-6 text-center text-muted">
                Δεν υπάρχουν συμφωνίες ακόμα
              </li>
            ) : null}
          </ul>
        </Card>
      </div>
      {msg ? <p className="text-sm text-muted">{msg}</p> : null}
    </div>
  );
}
