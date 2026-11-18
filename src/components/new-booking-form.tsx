"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Card } from "@/components/ui";
import { LicenseOcrButton } from "@/components/license-ocr-button";
import { LicenseCategoriesEditor } from "@/components/license-categories-editor";
import {
  formatCurrency,
  isReturnAfterPickup,
  rentalDays,
  RETURN_AFTER_PICKUP_MSG,
  returnOneHourAfterPickup,
  toLocalInput,
  vehicleTypeLabel,
} from "@/lib/utils";
import { checkLicenseForVehicleType } from "@/lib/license-categories";

type Category = {
  id: string;
  name: string;
  vehicleType: string;
  baseDailyRate: number;
  depositAmount: number;
};

type Vehicle = {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  vehicleType: string;
  status: string;
  categoryId: string | null;
  availableForDates?: boolean;
  conflictCode?: string | null;
  availabilityLabel?: string;
  category: {
    id?: string;
    name?: string;
    baseDailyRate: number;
    depositAmount: number;
    transmission?: string | null;
  } | null;
  branch: { id: string; name: string } | null;
};

type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
};

type Branch = { id: string; name: string };
type Extra = {
  id: string;
  name: string;
  dailyRate: number;
  flatRate: number | null;
};

const COVERAGES = [
  { id: "CDW", label: "CDW — Ίδιες ζημιές" },
  { id: "SCDW", label: "SCDW — Πλήρης απαλλαγή" },
  { id: "TP", label: "TP — Κλοπή" },
  { id: "PAI", label: "PAI — Προσωπική κάλυψη" },
];

export function NewBookingForm() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"existing" | "new">("new");

  const pickupDefault = new Date();
  pickupDefault.setMinutes(0, 0, 0);
  pickupDefault.setHours(pickupDefault.getHours() + 1);
  const [categoryId, setCategoryId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [pickupAt, setPickupAt] = useState(toLocalInput(pickupDefault));
  const [returnAt, setReturnAt] = useState(
    returnOneHourAfterPickup(toLocalInput(pickupDefault))
  );
  const [pickupBranchId, setPickupBranchId] = useState("");
  const [dailyRate, setDailyRate] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [coverages, setCoverages] = useState<string[]>(["CDW"]);
  const [notes, setNotes] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"UNPAID" | "PAID" | "PARTIAL">("UNPAID");
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [customer, setCustomer] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    afm: "",
    licenseNumber: "",
    licenseCategories: "",
    idDocumentNo: "",
    isForeign: false,
  });
  const [licenseImages, setLicenseImages] = useState({
    frontImageDataUrl: "",
    backImageDataUrl: "",
  });

  const datesValid = isReturnAfterPickup(pickupAt, returnAt);

  useEffect(() => {
    const pickupDate = new Date(pickupAt);
    const returnDate = new Date(returnAt);
    if (
      Number.isNaN(pickupDate.getTime()) ||
      Number.isNaN(returnDate.getTime()) ||
      !isReturnAfterPickup(pickupAt, returnAt)
    ) {
      return;
    }

    const controller = new AbortController();
    setCheckingAvailability(true);
    const qs = new URLSearchParams({
      pickupAt: pickupDate.toISOString(),
      returnAt: returnDate.toISOString(),
    });

    fetch(`/api/bookings/meta?${qs}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        setVehicles(d.vehicles || []);
        setCategories(d.categories || []);
        setCustomers(d.customers || []);
        setBranches(d.branches || []);
        setExtras(d.extras || []);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setError("Αποτυχία φόρτωσης δεδομένων");
      })
      .finally(() => setCheckingAvailability(false));

    return () => controller.abort();
  }, [pickupAt, returnAt]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      if (categoryId && v.categoryId !== categoryId) return false;
      return v.availableForDates !== false;
    });
  }, [vehicles, categoryId]);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === vehicleId),
    [vehicles, vehicleId]
  );

  useEffect(() => {
    if (!filteredVehicles.length) {
      setVehicleId("");
      return;
    }
    if (!filteredVehicles.some((v) => v.id === vehicleId)) {
      const first = filteredVehicles[0];
      setVehicleId(first.id);
      if (!pickupBranchId && first.branch?.id) {
        setPickupBranchId(first.branch.id);
      }
    }
  }, [filteredVehicles, vehicleId, pickupBranchId]);

  useEffect(() => {
    if (!selectedVehicle) return;
    setDailyRate(String(selectedVehicle.category?.baseDailyRate ?? 40));
    setDepositAmount(String(selectedVehicle.category?.depositAmount ?? 300));
    if (selectedVehicle.branch?.id) setPickupBranchId(selectedVehicle.branch.id);
  }, [selectedVehicle]);

  const estimate = useMemo(() => {
    const rate = Number(dailyRate) || 0;
    const days = rentalDays(pickupAt, returnAt);
    const total = rate * days;
    return { days, total };
  }, [dailyRate, pickupAt, returnAt]);

  const licenseCheck = useMemo(() => {
    if (!selectedVehicle || !customer.licenseCategories.trim()) return null;
    return checkLicenseForVehicleType({
      vehicleType: selectedVehicle.vehicleType,
      licenseCategories: customer.licenseCategories,
      pickupAt: new Date(pickupAt),
      vehicleTransmission: selectedVehicle.category?.transmission,
      requireCategories: true,
    });
  }, [selectedVehicle, customer.licenseCategories, pickupAt]);

  function toggleCoverage(id: string) {
    setCoverages((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function onPickupChange(value: string) {
    setPickupAt(value);
    setReturnAt(returnOneHourAfterPickup(value));
  }

  function onReturnChange(value: string) {
    setReturnAt(value);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isReturnAfterPickup(pickupAt, returnAt)) {
      setError(RETURN_AFTER_PICKUP_MSG);
      return;
    }
    if (licenseCheck && !licenseCheck.ok) {
      setError(licenseCheck.message);
      return;
    }
    setLoading(true);
    setError("");

    const payload: Record<string, unknown> = {
      vehicleId,
      pickupAt: new Date(pickupAt).toISOString(),
      returnAt: new Date(returnAt).toISOString(),
      pickupBranchId: pickupBranchId || null,
      returnBranchId: pickupBranchId || null,
      dailyRate: Number(dailyRate),
      depositAmount: Number(depositAmount),
      coverages,
      extraIds,
      notes,
      paymentStatus,
      licenseFrontImage: licenseImages.frontImageDataUrl || null,
      licenseBackImage: licenseImages.backImageDataUrl || null,
    };

    if (mode === "existing") {
      payload.customerId = customerId;
    } else {
      payload.customer = customer;
    }

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Αποτυχία");
      return;
    }
    router.push(`/bookings/${data.booking.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <h2 className="font-display text-lg">Όχημα & ημερομηνίες</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <Label>Κατηγορία</Label>
            <select
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Όλες οι κατηγορίες</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {vehicleTypeLabel(c.vehicleType)} ·{" "}
                  {formatCurrency(c.baseDailyRate)}/ημέρα
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Όχημα</Label>
            <select
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              required
              disabled={checkingAvailability}
            >
              {filteredVehicles.length === 0 ? (
                <option value="">
                  {checkingAvailability
                    ? "Έλεγχος διαθεσιμότητας…"
                    : "— κανένα διαθέσιμο για αυτές τις ημερομηνίες —"}
                </option>
              ) : (
                filteredVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber} — {v.make} {v.model}
                    {v.category?.name ? ` · ${v.category.name}` : ""} ·{" "}
                    {v.availabilityLabel || "ΔΙΑΘΕΣΙΜΟ"}
                  </option>
                ))
              )}
            </select>
            {!checkingAvailability && filteredVehicles.length === 0 ? (
              <p className="mt-1.5 text-xs text-amber-700">
                Όλα τα οχήματα
                {categoryId ? " αυτής της κατηγορίας" : ""} είναι ήδη
                νοικιασμένα για το επιλεγμένο διάστημα.
              </p>
            ) : null}
          </div>
          <div>
            <Label>Παραλαβή</Label>
            <Input
              type="datetime-local"
              value={pickupAt}
              onChange={(e) => onPickupChange(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Επιστροφή</Label>
            <Input
              type="datetime-local"
              value={returnAt}
              min={pickupAt}
              onChange={(e) => onReturnChange(e.target.value)}
              required
            />
            {!datesValid ? (
              <p className="mt-1.5 text-xs text-red-600">
                {RETURN_AFTER_PICKUP_MSG}
              </p>
            ) : null}
          </div>
          <div>
            <Label>Κατάστημα</Label>
            <select
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
              value={pickupBranchId}
              onChange={(e) => setPickupBranchId(e.target.value)}
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
            <Label>Ημερήσια τιμή (€)</Label>
            <Input
              type="number"
              min={1}
              step="0.01"
              value={dailyRate}
              onChange={(e) => setDailyRate(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Εγγύηση (€)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
          </div>
          <div>
            <Label>Πληρωμή</Label>
            <select
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
              value={paymentStatus}
              onChange={(e) =>
                setPaymentStatus(e.target.value as typeof paymentStatus)
              }
            >
              <option value="UNPAID">Απλήρωτο</option>
              <option value="PARTIAL">Μερική</option>
              <option value="PAID">Εξοφλημένο</option>
            </select>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted">
          Εκτίμηση: {estimate.days} ημέρες ·{" "}
          <strong className="text-foreground">
            {formatCurrency(estimate.total)}
          </strong>{" "}
          (με ΦΠΑ)
        </p>
        <p className="mt-1 text-xs text-muted">
          Χρέωση: 24 ώρες = 1 ημέρα · έως +3 ώρες χωρίς έξτρα · πάνω από 27
          ώρες χρεώνεται επιπλέον ημέρα.
        </p>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg">Πελάτης / οδηγός</h2>
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              className={mode === "new" ? "font-medium text-accent" : "text-muted"}
              onClick={() => setMode("new")}
            >
              Νέος
            </button>
            <span className="text-border">|</span>
            <button
              type="button"
              className={
                mode === "existing" ? "font-medium text-accent" : "text-muted"
              }
              onClick={() => setMode("existing")}
            >
              Υπάρχων
            </button>
          </div>
        </div>

        {mode === "new" ? (
          <div className="mt-3">
            <LicenseOcrButton
              onImages={setLicenseImages}
              onResult={(fields) =>
                setCustomer((c) => ({
                  ...c,
                  firstName: fields.firstName || c.firstName,
                  lastName: fields.lastName || c.lastName,
                  licenseNumber: fields.licenseNumber || c.licenseNumber,
                  licenseCategories:
                    fields.licenseCategories || c.licenseCategories,
                  afm: fields.afm || c.afm,
                  idDocumentNo: fields.idDocumentNo || c.idDocumentNo,
                  isForeign: fields.licenseCountry
                    ? fields.licenseCountry !== "GR"
                    : c.isForeign,
                }))
              }
            />
            {licenseImages.frontImageDataUrl ? (
              <p className="mt-1 text-xs text-emerald-700">
                Οι φωτογραφίες άδειας θα αποθηκευτούν ως PDF μέχρι την επιστροφή
                του οχήματος.
              </p>
            ) : null}
          </div>
        ) : null}

        {mode === "existing" ? (
          <div className="mt-4">
            <Label>Επιλογή πελάτη</Label>
            <select
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
            >
              <option value="">— επίλεξε —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.lastName} {c.firstName}
                  {c.phone ? ` · ${c.phone}` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
          <p className="mt-3 text-xs text-muted">
            Τα πεδία παρακάτω είναι επεξεργάσιμα — αν το OCR κάνει λάθος,
            διόρθωσέ τα χειροκίνητα πριν την αποθήκευση.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <Label>Όνομα</Label>
              <Input
                value={customer.firstName}
                onChange={(e) =>
                  setCustomer((c) => ({ ...c, firstName: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <Label>Επώνυμο</Label>
              <Input
                value={customer.lastName}
                onChange={(e) =>
                  setCustomer((c) => ({ ...c, lastName: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <Label>Αρ. διπλώματος</Label>
              <Input
                value={customer.licenseNumber}
                onChange={(e) =>
                  setCustomer((c) => ({
                    ...c,
                    licenseNumber: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>ΑΦΜ</Label>
              <Input
                value={customer.afm}
                onChange={(e) =>
                  setCustomer((c) => ({ ...c, afm: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={customer.email}
                onChange={(e) =>
                  setCustomer((c) => ({ ...c, email: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Τηλέφωνο</Label>
              <Input
                value={customer.phone}
                onChange={(e) =>
                  setCustomer((c) => ({ ...c, phone: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Αρ. ταυτότητας / διαβατηρίου</Label>
              <Input
                value={customer.idDocumentNo}
                onChange={(e) =>
                  setCustomer((c) => ({
                    ...c,
                    idDocumentNo: e.target.value,
                  }))
                }
              />
            </div>
            <LicenseCategoriesEditor
              value={customer.licenseCategories}
              onChange={(licenseCategories) =>
                setCustomer((c) => ({ ...c, licenseCategories }))
              }
              error={
                licenseCheck && !licenseCheck.ok
                  ? licenseCheck.message
                  : null
              }
            />
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={customer.isForeign}
                onChange={(e) =>
                  setCustomer((c) => ({ ...c, isForeign: e.target.checked }))
                }
              />
              Αλλοδαπός (χωρίς ΑΦΜ)
            </label>
          </div>
          </>
        )}
      </Card>

      <Card>
        <h2 className="font-display text-lg">Καλύψεις & extras</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {COVERAGES.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={coverages.includes(c.id)}
                onChange={() => toggleCoverage(c.id)}
              />
              {c.label}
            </label>
          ))}
        </div>
        {extras.length > 0 ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {extras.map((e) => (
              <label key={e.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={extraIds.includes(e.id)}
                  onChange={() =>
                    setExtraIds((prev) =>
                      prev.includes(e.id)
                        ? prev.filter((x) => x !== e.id)
                        : [...prev, e.id]
                    )
                  }
                />
                {e.name} (
                {e.flatRate
                  ? `${e.flatRate}€ flat`
                  : `${e.dailyRate}€/ημέρα`}
                )
              </label>
            ))}
          </div>
        ) : null}
        <div className="mt-4">
          <Label>Σημειώσεις</Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="π.χ. παράδοση στο ξενοδοχείο"
          />
        </div>
      </Card>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Button
        type="submit"
        disabled={
          loading ||
          !vehicleId ||
          !datesValid ||
          Boolean(licenseCheck && !licenseCheck.ok)
        }
      >
        {loading ? "Αποθήκευση…" : "Δημιουργία κράτησης"}
      </Button>
    </form>
  );
}
