"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Input, Label } from "@/components/ui";
import { cn, compareCategoryNames, vehicleTypeLabel } from "@/lib/utils";

const CATALOG_TABS = [
  { id: "ALL", label: "Όλα" },
  { id: "CAR", label: "Αυτοκίνητα" },
  { id: "MOTO", label: "Μοτοσυκλέτες" },
  { id: "SCOOTER", label: "Σκούτερ" },
  { id: "VAN", label: "Van" },
] as const;

type VehicleSortKey =
  | "plateNumber"
  | "vehicle"
  | "vehicleType"
  | "category"
  | "status"
  | "branch";

const VEHICLE_SORT_COLS: { key: VehicleSortKey; label: string }[] = [
  { key: "plateNumber", label: "Πινακίδα" },
  { key: "vehicle", label: "Όχημα" },
  { key: "vehicleType", label: "Τύπος" },
  { key: "category", label: "Κατηγορία" },
  { key: "status", label: "Κατάσταση" },
  { key: "branch", label: "Κατάστημα" },
];

type Category = {
  id: string;
  name: string;
  vehicleType: string;
  baseDailyRate?: number;
  depositAmount?: number;
};
type Branch = { id: string; name: string };
type Vehicle = {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number | null;
  color: string | null;
  vehicleType: string;
  status: string;
  active: boolean;
  odometerKm: number;
  fuelType: string | null;
  notes: string | null;
  categoryId: string | null;
  branchId: string | null;
  insuranceExpiry: string | Date | null;
  kteoExpiry: string | Date | null;
  mechanicalExpiry: string | Date | null;
  category: Category | null;
  branch: Branch | null;
};

type FormState = {
  plateNumber: string;
  make: string;
  model: string;
  year: string;
  color: string;
  vehicleType: string;
  status: string;
  categoryId: string;
  branchId: string;
  odometerKm: string;
  fuelType: string;
  insuranceExpiry: string;
  kteoExpiry: string;
  mechanicalExpiry: string;
  notes: string;
  active: boolean;
};

const empty: FormState = {
  plateNumber: "",
  make: "",
  model: "",
  year: "",
  color: "",
  vehicleType: "CAR",
  status: "AVAILABLE",
  categoryId: "",
  branchId: "",
  odometerKm: "0",
  fuelType: "",
  insuranceExpiry: "",
  kteoExpiry: "",
  mechanicalExpiry: "",
  notes: "",
  active: true,
};

function toDateInput(v: string | Date | null | undefined) {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function vehicleToForm(v: Vehicle): FormState {
  return {
    plateNumber: v.plateNumber || "",
    make: v.make || "",
    model: v.model || "",
    year: v.year != null ? String(v.year) : "",
    color: v.color || "",
    vehicleType: v.vehicleType || "CAR",
    status: v.status || "AVAILABLE",
    categoryId: v.categoryId || "",
    branchId: v.branchId || "",
    odometerKm: String(v.odometerKm ?? 0),
    fuelType: v.fuelType || "",
    insuranceExpiry: toDateInput(v.insuranceExpiry),
    kteoExpiry: toDateInput(v.kteoExpiry),
    mechanicalExpiry: toDateInput(v.mechanicalExpiry),
    notes: v.notes || "",
    active: v.active,
  };
}

function formPayload(form: FormState) {
  return {
    plateNumber: form.plateNumber,
    make: form.make,
    model: form.model,
    year: form.year ? Number(form.year) : null,
    color: form.color || null,
    vehicleType: form.vehicleType,
    status: form.status,
    odometerKm: Number(form.odometerKm) || 0,
    fuelType: form.fuelType || null,
    categoryId: form.categoryId || null,
    branchId: form.branchId || null,
    insuranceExpiry: form.insuranceExpiry || null,
    kteoExpiry: form.kteoExpiry || null,
    mechanicalExpiry: form.mechanicalExpiry || null,
    notes: form.notes || null,
    active: form.active,
  };
}

const STATUS_OPTIONS = [
  "AVAILABLE",
  "RENTED",
  "MAINTENANCE",
  "BLOCKED",
  "OUT_OF_SERVICE",
] as const;

export function FleetManager({
  initialVehicles,
}: {
  initialVehicles: Vehicle[];
}) {
  const router = useRouter();
  const [vehicles, setVehicles] = useState(initialVehicles);
  const [categories, setCategories] = useState<Category[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [form, setForm] = useState<FormState>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const emptyCat = {
    name: "",
    vehicleType: "CAR",
    baseDailyRate: "40",
    depositAmount: "300",
  };
  const [catForm, setCatForm] = useState(emptyCat);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null
  );
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [catalogType, setCatalogType] = useState<string>("ALL");
  const [sortKey, setSortKey] = useState<VehicleSortKey>("category");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: VehicleSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  useEffect(() => {
    setVehicles(initialVehicles);
  }, [initialVehicles]);

  useEffect(() => {
    Promise.all([
      fetch("/api/categories").then((r) => r.json()),
      fetch("/api/branches").then((r) => r.json()),
    ]).then(([c, b]) => {
      const cats = (c.categories || []) as Category[];
      cats.sort((a, b) => compareCategoryNames(a.name, b.name));
      setCategories(cats);
      setBranches(b.branches || []);
    });
  }, []);

  const sortedCategories = useMemo(
    () =>
      [...categories].sort((a, b) => compareCategoryNames(a.name, b.name)),
    [categories]
  );

  const catalogCategories = useMemo(
    () =>
      catalogType === "ALL"
        ? sortedCategories
        : sortedCategories.filter((c) => c.vehicleType === catalogType),
    [sortedCategories, catalogType]
  );

  const catalogVehicles = useMemo(() => {
    const list =
      catalogType === "ALL"
        ? vehicles
        : vehicles.filter((v) => v.vehicleType === catalogType);
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      let cmp = 0;
      switch (sortKey) {
        case "plateNumber":
          cmp = a.plateNumber.localeCompare(b.plateNumber, "el", {
            numeric: true,
          });
          break;
        case "vehicle":
          cmp = `${a.make} ${a.model}`.localeCompare(
            `${b.make} ${b.model}`,
            "el",
            { sensitivity: "base" }
          );
          if (cmp === 0) cmp = (a.year || 0) - (b.year || 0);
          break;
        case "vehicleType":
          cmp = vehicleTypeLabel(a.vehicleType).localeCompare(
            vehicleTypeLabel(b.vehicleType),
            "el"
          );
          break;
        case "category":
          cmp = compareCategoryNames(
            a.category?.name || "",
            b.category?.name || ""
          );
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "branch":
          cmp = (a.branch?.name || "").localeCompare(b.branch?.name || "", "el");
          break;
      }
      if (cmp !== 0) return cmp * dir;
      return (
        a.plateNumber.localeCompare(b.plateNumber, "el", { numeric: true }) * dir
      );
    });
  }, [vehicles, catalogType, sortKey, sortDir]);

  async function refreshVehicles() {
    const list = await fetch("/api/fleet").then((r) => r.json());
    setVehicles(list.vehicles || []);
    router.refresh();
  }

  function startEdit(v: Vehicle) {
    setEditingId(v.id);
    setForm(vehicleToForm(v));
    setMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(empty);
    setMsg("");
  }

  async function saveVehicle(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    const payload = formPayload(form);
    const res = await fetch(
      editingId ? `/api/fleet/${editingId}` : "/api/fleet",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error || "Αποτυχία");
      return;
    }
    setMsg(editingId ? "Το όχημα ενημερώθηκε" : "Όχημα προστέθηκε");
    setEditingId(null);
    setForm(empty);
    await refreshVehicles();
  }

  async function refreshCategories() {
    const c = await fetch("/api/categories").then((r) => r.json());
    setCategories(c.categories || []);
  }

  function startEditCategory(c: Category) {
    setEditingCategoryId(c.id);
    setCatForm({
      name: c.name,
      vehicleType: c.vehicleType || "CAR",
      baseDailyRate: String(c.baseDailyRate ?? 40),
      depositAmount: String(c.depositAmount ?? 300),
    });
    setMsg("");
  }

  function cancelEditCategory() {
    setEditingCategoryId(null);
    setCatForm(emptyCat);
  }

  async function saveCategory(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    const payload = {
      name: catForm.name,
      vehicleType: catForm.vehicleType,
      baseDailyRate: Number(catForm.baseDailyRate),
      depositAmount: Number(catForm.depositAmount),
    };
    const res = await fetch(
      editingCategoryId
        ? `/api/categories/${editingCategoryId}`
        : "/api/categories",
      {
        method: editingCategoryId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMsg(data.error || "Αποτυχία κατηγορίας");
      return;
    }
    setEditingCategoryId(null);
    setCatForm(emptyCat);
    await refreshCategories();
    await refreshVehicles();
    setMsg(editingCategoryId ? "Η κατηγορία ενημερώθηκε" : "Κατηγορία OK");
  }

  async function deleteCategory(id: string, name: string) {
    if (!confirm(`Διαγραφή κατηγορίας «${name}»;`)) return;
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error || "Αποτυχία διαγραφής");
      return;
    }
    if (editingCategoryId === id) cancelEditCategory();
    await refreshCategories();
    setMsg("Κατηγορία διαγράφηκε");
  }

  async function deactivate(id: string) {
    if (!confirm("Απενεργοποίηση οχήματος;")) return;
    await fetch(`/api/fleet/${id}?soft=1`, { method: "DELETE" });
    if (editingId === id) cancelEdit();
    await refreshVehicles();
    setMsg("Το όχημα απενεργοποιήθηκε");
  }

  async function deleteVehicle(id: string, plate: string) {
    if (
      !confirm(
        `Οριστική διαγραφή του οχήματος «${plate}»; Δεν αναιρείται.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/fleet/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error || "Αποτυχία διαγραφής");
      return;
    }
    if (editingId === id) cancelEdit();
    await refreshVehicles();
    setMsg("Το όχημα διαγράφηκε");
  }

  async function reactivate(id: string) {
    await fetch(`/api/fleet/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true, status: "AVAILABLE" }),
    });
    await refreshVehicles();
    setMsg("Το όχημα ενεργοποιήθηκε ξανά");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5">
        {CATALOG_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setCatalogType(t.id);
              if (t.id !== "ALL") {
                setCatForm((f) => ({ ...f, vehicleType: t.id }));
                setForm((f) => ({ ...f, vehicleType: t.id }));
              }
            }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              catalogType === t.id
                ? "bg-ink text-white"
                : "border border-border bg-surface text-muted hover:bg-slate-50"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted">
        Κατάλογος:{" "}
        <strong className="text-ink">
          {CATALOG_TABS.find((t) => t.id === catalogType)?.label}
        </strong>{" "}
        · κατηγορίες CAT A→B→C… ·{" "}
        {catalogVehicles.filter((v) => v.active).length} ενεργά οχήματα
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg">
              {editingId ? "Διόρθωση οχήματος" : "Νέο όχημα"}
            </h2>
            {editingId ? (
              <button
                type="button"
                className="text-sm text-accent hover:underline"
                onClick={cancelEdit}
              >
                Ακύρωση επεξεργασίας
              </button>
            ) : null}
          </div>
          <form onSubmit={saveVehicle} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Πινακίδα</Label>
              <Input
                required
                value={form.plateNumber}
                onChange={(e) =>
                  setForm((f) => ({ ...f, plateNumber: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Τύπος</Label>
              <select
                className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
                value={form.vehicleType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, vehicleType: e.target.value }))
                }
              >
                {["CAR", "MOTO", "SCOOTER", "VAN"].map((t) => (
                  <option key={t} value={t}>
                    {vehicleTypeLabel(t)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Μάρκα</Label>
              <Input
                required
                value={form.make}
                onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))}
              />
            </div>
            <div>
              <Label>Μοντέλο</Label>
              <Input
                required
                value={form.model}
                onChange={(e) =>
                  setForm((f) => ({ ...f, model: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Έτος</Label>
              <Input
                type="number"
                value={form.year}
                onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
              />
            </div>
            <div>
              <Label>Χρώμα</Label>
              <Input
                value={form.color}
                onChange={(e) =>
                  setForm((f) => ({ ...f, color: e.target.value }))
                }
              />
            </div>
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
              <Label>Καύσιμο</Label>
              <Input
                value={form.fuelType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fuelType: e.target.value }))
                }
                placeholder="Βενζίνη / Diesel / Ηλεκτρικό"
              />
            </div>
            <div>
              <Label>Κατάσταση</Label>
              <select
                className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value }))
                }
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Κατηγορία</Label>
              <select
                className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
                value={form.categoryId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, categoryId: e.target.value }))
                }
              >
                <option value="">—</option>
                {sortedCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {vehicleTypeLabel(c.vehicleType)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Κατάστημα</Label>
              <select
                className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
                value={form.branchId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, branchId: e.target.value }))
                }
              >
                <option value="">—</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Ασφάλεια έως</Label>
              <Input
                type="date"
                value={form.insuranceExpiry}
                onChange={(e) =>
                  setForm((f) => ({ ...f, insuranceExpiry: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>ΚΤΕΟ έως</Label>
              <Input
                type="date"
                value={form.kteoExpiry}
                onChange={(e) =>
                  setForm((f) => ({ ...f, kteoExpiry: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Μηχανολογικός έως</Label>
              <Input
                type="date"
                value={form.mechanicalExpiry}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    mechanicalExpiry: e.target.value,
                  }))
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
            {editingId ? (
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, active: e.target.checked }))
                  }
                />
                Ενεργό όχημα
              </label>
            ) : null}
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" disabled={loading}>
                {editingId ? "Αποθήκευση διόρθωσης" : "Προσθήκη οχήματος"}
              </Button>
              {editingId ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={cancelEdit}
                  disabled={loading}
                >
                  Ακύρωση
                </Button>
              ) : null}
            </div>
          </form>
        </Card>

        <Card>
          <h2 className="font-display text-lg">Κατηγορίες (CAT A→B→C…)</h2>
          {catalogCategories.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              Δεν υπάρχουν κατηγορίες σε αυτόν τον κατάλογο.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
              {catalogCategories.map((c) => (
                <li
                  key={c.id}
                  className={`flex items-center justify-between gap-2 px-3 py-2 text-sm ${
                    editingCategoryId === c.id ? "bg-accent/5" : ""
                  }`}
                >
                  <span className="font-medium">
                    {c.name}{" "}
                    <span className="font-normal text-muted">
                      · {vehicleTypeLabel(c.vehicleType)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                    {c.baseDailyRate != null
                      ? `${c.baseDailyRate}€/ημ`
                      : ""}
                    {c.depositAmount != null
                      ? ` · εγγ. ${c.depositAmount}€`
                      : ""}
                    <button
                      type="button"
                      className="text-accent hover:underline"
                      onClick={() => startEditCategory(c)}
                    >
                      Διόρθωση
                    </button>
                    <button
                      type="button"
                      className="text-danger hover:underline"
                      onClick={() => deleteCategory(c.id, c.name)}
                    >
                      Διαγραφή
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-base">
              {editingCategoryId ? "Διόρθωση κατηγορίας" : "Νέα κατηγορία"}
            </h3>
            {editingCategoryId ? (
              <button
                type="button"
                className="text-sm text-accent hover:underline"
                onClick={cancelEditCategory}
              >
                Ακύρωση
              </button>
            ) : null}
          </div>
          <form onSubmit={saveCategory} className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Όνομα</Label>
              <Input
                required
                value={catForm.name}
                onChange={(e) =>
                  setCatForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Economy"
              />
            </div>
            <div>
              <Label>Τύπος</Label>
              <select
                className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
                value={catForm.vehicleType}
                onChange={(e) =>
                  setCatForm((f) => ({ ...f, vehicleType: e.target.value }))
                }
              >
                {["CAR", "MOTO", "SCOOTER", "VAN"].map((t) => (
                  <option key={t} value={t}>
                    {vehicleTypeLabel(t)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>€ / ημέρα</Label>
              <Input
                type="number"
                required
                value={catForm.baseDailyRate}
                onChange={(e) =>
                  setCatForm((f) => ({ ...f, baseDailyRate: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Εγγύηση €</Label>
              <Input
                type="number"
                value={catForm.depositAmount}
                onChange={(e) =>
                  setCatForm((f) => ({ ...f, depositAmount: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" variant="secondary" disabled={loading}>
                {editingCategoryId
                  ? "Αποθήκευση διόρθωσης"
                  : "Προσθήκη κατηγορίας"}
              </Button>
              {editingCategoryId ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={cancelEditCategory}
                  disabled={loading}
                >
                  Ακύρωση
                </Button>
              ) : null}
            </div>
          </form>
        </Card>
      </div>

      {msg ? <p className="text-sm text-muted">{msg}</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-slate-50 text-xs uppercase text-muted">
            <tr>
              {VEHICLE_SORT_COLS.map((col) => {
                const active = sortKey === col.key;
                return (
                  <th key={col.key} className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={cn(
                        "inline-flex items-center gap-1 uppercase tracking-wide hover:text-ink",
                        active ? "font-semibold text-ink" : "font-medium"
                      )}
                      title="Κλικ για ταξινόμηση"
                    >
                      {col.label}
                      <span className="text-[10px] text-accent" aria-hidden>
                        {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                );
              })}
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {catalogVehicles.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-muted"
                >
                  Δεν υπάρχουν οχήματα σε αυτόν τον κατάλογο
                </td>
              </tr>
            ) : (
              catalogVehicles.map((v) => (
                <tr
                  key={v.id}
                  className={
                    !v.active
                      ? "opacity-50"
                      : editingId === v.id
                        ? "bg-accent/5"
                        : undefined
                  }
                >
                  <td className="px-4 py-3 font-medium">{v.plateNumber}</td>
                  <td className="px-4 py-3">
                    {v.make} {v.model}
                    {v.year ? ` (${v.year})` : ""}
                  </td>
                  <td className="px-4 py-3">
                    {vehicleTypeLabel(v.vehicleType)}
                  </td>
                  <td className="px-4 py-3">{v.category?.name || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        v.status === "AVAILABLE"
                          ? "success"
                          : v.status === "RENTED"
                            ? "accent"
                            : "warning"
                      }
                    >
                      {v.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{v.branch?.name || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <button
                        type="button"
                        className="text-xs text-accent hover:underline"
                        onClick={() => startEdit(v)}
                      >
                        Διόρθωση
                      </button>
                      {v.active ? (
                        <button
                          type="button"
                          className="text-xs text-muted hover:underline"
                          onClick={() => deactivate(v.id)}
                        >
                          Απενεργοποίηση
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="text-xs text-muted hover:underline"
                          onClick={() => reactivate(v.id)}
                        >
                          Επανενεργοποίηση
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-xs text-danger hover:underline"
                        onClick={() => deleteVehicle(v.id, v.plateNumber)}
                      >
                        Διαγραφή
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
