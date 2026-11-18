"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, Input, Label } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";

type Category = { id: string; name: string };
type Rule = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  multiplier: number;
  minDailyRate: number | null;
  weekendOnly: boolean;
  active: boolean;
  category: Category | null;
};
type Extra = {
  id: string;
  name: string;
  dailyRate: number;
  flatRate: number | null;
  active: boolean;
  code: string | null;
};

export function PricingManager() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    multiplier: "1.25",
    minDailyRate: "",
    weekendOnly: false,
    categoryId: "",
  });
  const [extraForm, setExtraForm] = useState({
    name: "",
    code: "",
    dailyRate: "5",
    flatRate: "",
  });

  async function load() {
    const res = await fetch("/api/pricing");
    if (!res.ok) return;
    const data = await res.json();
    setRules(data.rules || []);
    setExtras(data.extras || []);
    setCategories(data.categories || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    const res = await fetch("/api/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...ruleForm,
        multiplier: Number(ruleForm.multiplier),
        minDailyRate: ruleForm.minDailyRate
          ? Number(ruleForm.minDailyRate)
          : null,
        categoryId: ruleForm.categoryId || null,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      setMsg("Αποτυχία κανόνα");
      return;
    }
    setRuleForm({
      name: "",
      startDate: "",
      endDate: "",
      multiplier: "1.25",
      minDailyRate: "",
      weekendOnly: false,
      categoryId: "",
    });
    setMsg("Κανόνας προστέθηκε");
    load();
  }

  async function createExtra(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/extras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: extraForm.name,
        code: extraForm.code || null,
        dailyRate: Number(extraForm.dailyRate) || 0,
        flatRate: extraForm.flatRate ? Number(extraForm.flatRate) : null,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      setMsg("Αποτυχία extra");
      return;
    }
    setExtraForm({ name: "", code: "", dailyRate: "5", flatRate: "" });
    setMsg("Extra προστέθηκε");
    load();
  }

  async function deactivateRule(id: string) {
    await fetch(`/api/pricing/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg">Κανόνας τιμής</h2>
          <p className="mt-1 text-xs text-muted">
            Multiplier πάνω από τη base ημερήσια τιμή κατηγορίας
          </p>
          <form onSubmit={createRule} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Όνομα</Label>
              <Input
                required
                value={ruleForm.name}
                onChange={(e) =>
                  setRuleForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Αύγουστος peak"
              />
            </div>
            <div>
              <Label>Από</Label>
              <Input
                type="date"
                required
                value={ruleForm.startDate}
                onChange={(e) =>
                  setRuleForm((f) => ({ ...f, startDate: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Έως</Label>
              <Input
                type="date"
                required
                value={ruleForm.endDate}
                onChange={(e) =>
                  setRuleForm((f) => ({ ...f, endDate: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Multiplier</Label>
              <Input
                type="number"
                step="0.05"
                min="0.1"
                required
                value={ruleForm.multiplier}
                onChange={(e) =>
                  setRuleForm((f) => ({ ...f, multiplier: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Min €/ημέρα (προαιρετικό)</Label>
              <Input
                type="number"
                value={ruleForm.minDailyRate}
                onChange={(e) =>
                  setRuleForm((f) => ({ ...f, minDailyRate: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Κατηγορία</Label>
              <select
                className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
                value={ruleForm.categoryId}
                onChange={(e) =>
                  setRuleForm((f) => ({ ...f, categoryId: e.target.value }))
                }
              >
                <option value="">Όλες</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ruleForm.weekendOnly}
                onChange={(e) =>
                  setRuleForm((f) => ({
                    ...f,
                    weekendOnly: e.target.checked,
                  }))
                }
              />
              Μόνο Σάββατο/Κυριακή
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={loading}>
                Προσθήκη κανόνα
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <h2 className="font-display text-lg">Extra</h2>
          <form onSubmit={createExtra} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Όνομα</Label>
              <Input
                required
                value={extraForm.name}
                onChange={(e) =>
                  setExtraForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="GPS"
              />
            </div>
            <div>
              <Label>Κωδικός</Label>
              <Input
                value={extraForm.code}
                onChange={(e) =>
                  setExtraForm((f) => ({ ...f, code: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>€ / ημέρα</Label>
              <Input
                type="number"
                step="0.01"
                value={extraForm.dailyRate}
                onChange={(e) =>
                  setExtraForm((f) => ({ ...f, dailyRate: e.target.value }))
                }
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Ή flat € (αντί ημερήσιας)</Label>
              <Input
                type="number"
                step="0.01"
                value={extraForm.flatRate}
                onChange={(e) =>
                  setExtraForm((f) => ({ ...f, flatRate: e.target.value }))
                }
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" variant="secondary" disabled={loading}>
                Προσθήκη extra
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {msg ? <p className="text-sm text-muted">{msg}</p> : null}

      <Card>
        <h2 className="font-display text-lg">Κανόνες</h2>
        <ul className="mt-3 divide-y divide-border text-sm">
          {rules.length === 0 ? (
            <li className="py-2 text-muted">Κανένας κανόνας ακόμα.</li>
          ) : (
            rules.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div>
                  <p className="font-medium">
                    {r.name}{" "}
                    {!r.active ? (
                      <Badge tone="neutral">ανενεργό</Badge>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDate(r.startDate)} → {formatDate(r.endDate)} · ×
                    {r.multiplier}
                    {r.weekendOnly ? " · ΣΚ" : ""}
                    {r.category ? ` · ${r.category.name}` : " · όλες"}
                    {r.minDailyRate
                      ? ` · min ${formatCurrency(r.minDailyRate)}`
                      : ""}
                  </p>
                </div>
                {r.active ? (
                  <button
                    type="button"
                    className="text-xs text-danger hover:underline"
                    onClick={() => deactivateRule(r.id)}
                  >
                    Απενεργοποίηση
                  </button>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </Card>

      <Card>
        <h2 className="font-display text-lg">Extras</h2>
        <ul className="mt-3 divide-y divide-border text-sm">
          {extras.length === 0 ? (
            <li className="py-2 text-muted">Κανένα extra ακόμα.</li>
          ) : (
            extras.map((e) => (
              <li key={e.id} className="flex justify-between gap-2 py-2">
                <span>
                  {e.name}
                  {e.code ? ` (${e.code})` : ""}
                </span>
                <span className="text-muted">
                  {e.flatRate != null && e.flatRate > 0
                    ? `${formatCurrency(e.flatRate)} flat`
                    : `${formatCurrency(e.dailyRate)}/ημέρα`}
                </span>
              </li>
            ))
          )}
        </ul>
      </Card>
    </div>
  );
}
