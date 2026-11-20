"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Input, Label } from "@/components/ui";
import {
  compareCategoryNames,
  formatCurrency,
  vehicleTypeLabel,
} from "@/lib/utils";

type Category = {
  id: string;
  name: string;
  vehicleType: string;
  baseDailyRate: number;
};

type Deal = {
  id: string;
  badge: string;
  title: string;
  body: string | null;
  cta: string;
  priceLabel: string | null;
  discountType: string;
  dealValue: number;
  paidDays: number | null;
  active: boolean;
  validFrom: string | null;
  validTo: string | null;
  minDays: number | null;
  categoryId: string | null;
  sortOrder: number;
  category?: { id: string; name: string } | null;
};

const emptyForm = {
  badge: "Προσφορά",
  title: "",
  body: "",
  cta: "Κλείσε τώρα",
  priceLabel: "",
  discountType: "FREE_DAYS",
  dealValue: "1",
  paidDays: "5",
  active: true,
  validFrom: "",
  validTo: "",
  minDays: "",
  categoryId: "",
  sortOrder: "0",
};

export function DealsManager() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const sortedCategories = useMemo(
    () =>
      [...categories].sort((a, b) => compareCategoryNames(a.name, b.name)),
    [categories]
  );

  async function load() {
    const res = await fetch("/api/deals");
    const data = await res.json().catch(() => ({}));
    setDeals(data.deals || []);
    setCategories(data.categories || []);
  }

  useEffect(() => {
    void load();
  }, []);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setMsg("");
  }

  function startEdit(d: Deal) {
    setEditingId(d.id);
    setForm({
      badge: d.badge || "Προσφορά",
      title: d.title,
      body: d.body || "",
      cta: d.cta || "Κλείσε τώρα",
      priceLabel: d.priceLabel || "",
      discountType: d.discountType || "FREE_DAYS",
      dealValue: String(d.dealValue ?? 1),
      paidDays: d.paidDays != null ? String(d.paidDays) : "5",
      active: d.active,
      validFrom: d.validFrom ? d.validFrom.slice(0, 10) : "",
      validTo: d.validTo ? d.validTo.slice(0, 10) : "",
      minDays: d.minDays != null ? String(d.minDays) : "",
      categoryId: d.categoryId || "",
      sortOrder: String(d.sortOrder ?? 0),
    });
    setMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function payload() {
    return {
      badge: form.badge.trim() || "Προσφορά",
      title: form.title.trim(),
      body: form.body.trim() || null,
      cta: form.cta.trim() || "Κλείσε τώρα",
      priceLabel: form.priceLabel.trim() || null,
      discountType: form.discountType,
      dealValue: Number(form.dealValue),
      paidDays:
        form.discountType === "FREE_DAYS"
          ? Number(form.paidDays) || null
          : null,
      active: form.active,
      validFrom: form.validFrom || null,
      validTo: form.validTo || null,
      minDays: form.minDays ? Number(form.minDays) : null,
      categoryId: form.categoryId || null,
      sortOrder: Number(form.sortOrder) || 0,
    };
  }

  async function save() {
    setLoading(true);
    setMsg("");
    try {
      const body = payload();
      if (!body.title) {
        setMsg("Βάλε τίτλο προσφοράς");
        return;
      }
      if (body.discountType === "FREE_DAYS" && !(body.paidDays && body.paidDays > 0)) {
        setMsg("Για 5+1 βάλε πληρωτέες ημέρες (π.χ. 5) και δωρεάν (π.χ. 1)");
        return;
      }

      const res = await fetch(
        editingId ? `/api/deals/${editingId}` : "/api/deals",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || "Αποτυχία αποθήκευσης");
        return;
      }
      setMsg(editingId ? "Ενημερώθηκε" : "Δημιουργήθηκε");
      setEditingId(null);
      setForm(emptyForm);
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Διαγραφή προσφοράς;")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/deals/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMsg(data.error || "Αποτυχία διαγραφής");
        return;
      }
      if (editingId === id) startCreate();
      await load();
    } finally {
      setLoading(false);
    }
  }

  const preview =
    form.discountType === "FREE_DAYS"
      ? `${form.paidDays || "5"}+${form.dealValue || "1"} δωρεάν`
      : form.discountType === "PERCENT"
        ? `-${form.dealValue}%`
        : `${formatCurrency(Number(form.dealValue) || 0)}/ημέρα`;

  return (
    <div className="space-y-6">
      <Card elevated padding="md">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg">
              {editingId ? "Επεξεργασία προσφοράς" : "Νέα προσφορά"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Π.χ. 5 μέρες + 1 δωρεάν — εφαρμόζεται αυτόματα στην online
              κράτηση.
            </p>
          </div>
          {editingId ? (
            <Button type="button" variant="secondary" onClick={startCreate}>
              Νέα
            </Button>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Τύπος</Label>
            <select
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
              value={form.discountType}
              onChange={(e) =>
                setForm((f) => ({ ...f, discountType: e.target.value }))
              }
            >
              <option value="FREE_DAYS">Δωρεάν ημέρες (5+1)</option>
              <option value="PERCENT">Ποσοστό έκπτωσης %</option>
              <option value="OVERRIDE_DAILY">Σταθερή ημερήσια τιμή</option>
            </select>
          </div>
          <div>
            <Label>Ετικέτα</Label>
            <Input
              value={form.badge}
              onChange={(e) =>
                setForm((f) => ({ ...f, badge: e.target.value }))
              }
              placeholder="Προσφορά"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Τίτλος</Label>
            <Input
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="5 ημέρες + 1 δωρεάν"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Περιγραφή (προαιρετικό)</Label>
            <Input
              value={form.body}
              onChange={(e) =>
                setForm((f) => ({ ...f, body: e.target.value }))
              }
              placeholder="Ισχύει για όλες τις κατηγορίες από 6 ημέρες και πάνω"
            />
          </div>

          {form.discountType === "FREE_DAYS" ? (
            <>
              <div>
                <Label>Πληρωτέες ημέρες</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.paidDays}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, paidDays: e.target.value }))
                  }
                  placeholder="5"
                />
              </div>
              <div>
                <Label>Δωρεάν ημέρες</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.dealValue}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dealValue: e.target.value }))
                  }
                  placeholder="1"
                />
              </div>
            </>
          ) : form.discountType === "PERCENT" ? (
            <div>
              <Label>Έκπτωση %</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={form.dealValue}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dealValue: e.target.value }))
                }
              />
            </div>
          ) : (
            <div>
              <Label>Ημερήσια τιμή (€)</Label>
              <Input
                type="number"
                min={1}
                step="0.01"
                value={form.dealValue}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dealValue: e.target.value }))
                }
              />
            </div>
          )}

          <div>
            <Label>Κείμενο τιμής (μπάρα)</Label>
            <Input
              value={form.priceLabel}
              onChange={(e) =>
                setForm((f) => ({ ...f, priceLabel: e.target.value }))
              }
              placeholder={preview}
            />
          </div>
          <div>
            <Label>CTA</Label>
            <Input
              value={form.cta}
              onChange={(e) => setForm((f) => ({ ...f, cta: e.target.value }))}
            />
          </div>
          <div>
            <Label>Κατηγορία (κενό = όλες)</Label>
            <select
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
              value={form.categoryId}
              onChange={(e) =>
                setForm((f) => ({ ...f, categoryId: e.target.value }))
              }
            >
              <option value="">Όλες οι κατηγορίες</option>
              {sortedCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {vehicleTypeLabel(c.vehicleType)} ·{" "}
                  {formatCurrency(c.baseDailyRate)}/ημ.
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Ελάχ. ημέρες (προαιρετικό)</Label>
            <Input
              type="number"
              min={1}
              value={form.minDays}
              onChange={(e) =>
                setForm((f) => ({ ...f, minDays: e.target.value }))
              }
              placeholder={
                form.discountType === "FREE_DAYS"
                  ? String(
                      (Number(form.paidDays) || 5) +
                        (Number(form.dealValue) || 1)
                    )
                  : ""
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
          <div className="flex items-end gap-3 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm((f) => ({ ...f, active: e.target.checked }))
                }
              />
              Ενεργή
            </label>
            <p className="text-sm text-muted">
              Προεπισκόπηση: <strong>{preview}</strong>
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => void save()} disabled={loading}>
            {loading ? "Αποθήκευση…" : editingId ? "Αποθήκευση" : "Προσθήκη"}
          </Button>
          {msg ? <p className="text-sm text-muted">{msg}</p> : null}
        </div>
      </Card>

      <Card elevated padding="md">
        <h2 className="font-display text-lg">Οι προσφορές σου</h2>
        {deals.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Δεν υπάρχουν ακόμα. Πρόσθεσε π.χ. «5+1 δωρεάν».
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {deals.map((d) => {
              const label =
                d.priceLabel ||
                (d.discountType === "FREE_DAYS"
                  ? `${d.paidDays}+${d.dealValue} δωρεάν`
                  : d.discountType === "PERCENT"
                    ? `-${d.dealValue}%`
                    : `${formatCurrency(d.dealValue)}/ημ.`);
              return (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-slate-50/60 px-4 py-3"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={d.active ? "accent" : "neutral"}>
                        {d.active ? d.badge : "Ανενεργή"}
                      </Badge>
                      <span className="font-medium text-ink">{d.title}</span>
                      <Badge tone="success">{label}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {d.category?.name || "Όλες οι κατηγορίες"}
                      {d.minDays ? ` · από ${d.minDays} ημέρες` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => startEdit(d)}
                    >
                      Επεξεργασία
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void remove(d.id)}
                    >
                      Διαγραφή
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
