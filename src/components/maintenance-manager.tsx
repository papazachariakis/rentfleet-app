"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Input, Label } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";

type VehicleOpt = {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
};

type Alert = {
  vehicleId: string;
  plateNumber: string;
  make: string;
  model: string;
  kind: string;
  label: string;
  dueAt: string;
  daysLeft: number;
  severity: "overdue" | "soon" | "ok";
};

type Log = {
  id: string;
  kind: string;
  title: string;
  notes: string | null;
  cost: number;
  odometerKm: number | null;
  performedAt: string;
  nextDueAt: string | null;
  vendor: string | null;
  vehicle: { plateNumber: string; make: string; model: string };
};

export function MaintenanceManager({
  vehicles,
  initialLogs,
  initialAlerts,
}: {
  vehicles: VehicleOpt[];
  initialLogs: Log[];
  initialAlerts: Alert[];
}) {
  const router = useRouter();
  const [logs, setLogs] = useState(initialLogs);
  const [alerts] = useState(initialAlerts);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    vehicleId: vehicles[0]?.id || "",
    kind: "SERVICE",
    title: "",
    notes: "",
    cost: "0",
    odometerKm: "",
    performedAt: new Date().toISOString().slice(0, 10),
    nextDueAt: "",
    vendor: "",
    syncVehicleExpiry: true,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    const res = await fetch("/api/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        cost: Number(form.cost) || 0,
        odometerKm: form.odometerKm ? Number(form.odometerKm) : null,
        nextDueAt: form.nextDueAt || null,
        notes: form.notes || null,
        vendor: form.vendor || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMsg(data.error || "Σφάλμα");
      return;
    }
    setMsg("Καταχωρήθηκε");
    setForm((f) => ({ ...f, title: "", notes: "", cost: "0", nextDueAt: "" }));
    const refreshed = await fetch("/api/maintenance").then((r) => r.json());
    setLogs(refreshed.logs || []);
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <h2 className="font-display text-lg">Νέα καταχώρηση</h2>
          <form onSubmit={submit} className="mt-4 space-y-3">
            <div>
              <Label>Όχημα</Label>
              <select
                className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
                value={form.vehicleId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, vehicleId: e.target.value }))
                }
                required
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber} · {v.make} {v.model}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Είδος</Label>
                <select
                  className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
                  value={form.kind}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, kind: e.target.value }))
                  }
                >
                  {[
                    ["SERVICE", "Service"],
                    ["REPAIR", "Επισκευή"],
                    ["KTEO", "ΚΤΕΟ"],
                    ["INSURANCE", "Ασφάλεια"],
                    ["OTHER", "Άλλο"],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Κόστος €</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.cost}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cost: e.target.value }))
                  }
                />
              </div>
            </div>
            <div>
              <Label>Τίτλος</Label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="π.χ. Αλλαγή λαδιών"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ημ/νία</Label>
                <Input
                  type="date"
                  value={form.performedAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, performedAt: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Επόμενη λήξη</Label>
                <Input
                  type="date"
                  value={form.nextDueAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nextDueAt: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Χλμ</Label>
                <Input
                  type="number"
                  value={form.odometerKm}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, odometerKm: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Προμηθευτής</Label>
                <Input
                  value={form.vendor}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, vendor: e.target.value }))
                  }
                />
              </div>
            </div>
            <div>
              <Label>Σημειώσεις</Label>
              <Input
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={form.syncVehicleExpiry}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    syncVehicleExpiry: e.target.checked,
                  }))
                }
              />
              Ενημέρωση λήξης στο όχημα
            </label>
            <Button type="submit" disabled={loading || !form.vehicleId}>
              Αποθήκευση
            </Button>
            {msg ? <p className="text-sm text-muted">{msg}</p> : null}
          </form>
        </Card>
      </div>

      <div className="space-y-4 lg:col-span-3">
        <Card>
          <h2 className="font-display text-lg">Ειδοποιήσεις λήξης</h2>
          {alerts.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              Καμία λήξη στις επόμενες 45 ημέρες.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border text-sm">
              {alerts.map((a, i) => (
                <li
                  key={`${a.vehicleId}-${a.kind}-${i}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div>
                    <p className="font-medium">
                      {a.plateNumber} · {a.label}
                    </p>
                    <p className="text-xs text-muted">
                      {a.make} {a.model} · {formatDate(a.dueAt)}
                    </p>
                  </div>
                  <Badge
                    tone={
                      a.severity === "overdue"
                        ? "danger"
                        : a.severity === "soon"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {a.daysLeft < 0
                      ? `${Math.abs(a.daysLeft)}η ληγμένο`
                      : `${a.daysLeft}η`}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-lg">Ιστορικό</h2>
          {logs.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Καμία καταχώρηση ακόμα.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border text-sm">
              {logs.map((l) => (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div>
                    <p className="font-medium">
                      {l.vehicle.plateNumber} · {l.title}
                    </p>
                    <p className="text-xs text-muted">
                      {l.kind} · {formatDate(l.performedAt)}
                      {l.odometerKm != null ? ` · ${l.odometerKm} km` : ""}
                      {l.vendor ? ` · ${l.vendor}` : ""}
                    </p>
                  </div>
                  <p className="font-medium">{formatCurrency(l.cost)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
