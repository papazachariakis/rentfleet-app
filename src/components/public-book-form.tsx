"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Input, Label } from "@/components/ui";
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
  seats: number | null;
  transmission: string | null;
};

type Branch = { id: string; name: string };
type Extra = {
  id: string;
  name: string;
  dailyRate: number;
  flatRate: number | null;
};

export function PublicBookForm({
  token,
  orgName,
  categories,
  branches,
  extras,
  paymentsEnabled,
  brandPrimary: _brandPrimary,
  partnerToken,
  partnerName,
}: {
  token: string;
  orgName: string;
  categories: Category[];
  branches: Branch[];
  extras: Extra[];
  paymentsEnabled: boolean;
  brandPrimary?: string;
  /** Ιδιωτικό token συμφωνίας broker/ξενοδοχείου */
  partnerToken?: string;
  partnerName?: string;
}) {
  void _brandPrimary;
  void orgName;
  const router = useRouter();
  const search = useSearchParams();
  const cancelled = search.get("cancelled") === "1";

  const pickupDefault = new Date();
  pickupDefault.setMinutes(0, 0, 0);
  pickupDefault.setHours(10, 0, 0, 0);
  if (pickupDefault.getTime() < Date.now()) {
    pickupDefault.setDate(pickupDefault.getDate() + 1);
  }
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [vehicleId, setVehicleId] = useState("");
  const [branchId, setBranchId] = useState(branches[0]?.id || "");
  const [pickupAt, setPickupAt] = useState(toLocalInput(pickupDefault));
  const [returnAt, setReturnAt] = useState(
    returnOneHourAfterPickup(toLocalInput(pickupDefault))
  );
  const [availability, setAvailability] = useState<{
    available: boolean;
    count?: number;
    quote?: {
      days: number;
      totalAmount: number;
      depositAmount: number;
      discountAmount?: number;
      retailDailyRate?: number;
      dealDailyRate?: number;
      deal?: {
        id: string;
        title: string;
        badge: string;
        priceLabel: string;
        freeDays: number;
        discountType: string;
      } | null;
    };
    vehicles?: {
      id: string;
      make: string;
      model: string;
      year: number | null;
      branchName: string | null;
    }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    afm: "",
    licenseNumber: "",
    licenseCategories: "",
    idDocumentNo: "",
    notes: "",
  });
  const [licenseImages, setLicenseImages] = useState({
    frontImageDataUrl: "",
    backImageDataUrl: "",
  });

  const selected = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId]
  );

  const datesValid = isReturnAfterPickup(pickupAt, returnAt);

  useEffect(() => {
    if (!categoryId || !pickupAt || !returnAt) return;
    if (!isReturnAfterPickup(pickupAt, returnAt)) {
      setAvailability(null);
      setVehicleId("");
      return;
    }
    const t = setTimeout(async () => {
      setChecking(true);
      const qs = new URLSearchParams({
        token,
        categoryId,
        pickupAt: new Date(pickupAt).toISOString(),
        returnAt: new Date(returnAt).toISOString(),
      });
      if (branchId) qs.set("branchId", branchId);
      if (extraIds.length) qs.set("extraIds", extraIds.join(","));
      if (partnerToken) qs.set("partnerToken", partnerToken);
      const res = await fetch(`/api/public/availability?${qs}`);
      const data = await res.json().catch(() => ({}));
      setChecking(false);
      if (!res.ok) {
        setAvailability({ available: false, vehicles: [] });
        setVehicleId("");
        setError(data.error || RETURN_AFTER_PICKUP_MSG);
        return;
      }
      setError("");
      const list = data.vehicles || [];
      setAvailability({
        available: data.available,
        count: data.count ?? list.length,
        quote: data.quote,
        vehicles: list,
      });
      setVehicleId((prev) =>
        list.some((v: { id: string }) => v.id === prev)
          ? prev
          : list[0]?.id || ""
      );
    }, 350);
    return () => clearTimeout(t);
  }, [token, partnerToken, categoryId, pickupAt, returnAt, branchId, extraIds]);

  function onPickupChange(value: string) {
    setPickupAt(value);
    setReturnAt(returnOneHourAfterPickup(value));
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
    const res = await fetch("/api/public/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        partnerToken: partnerToken || null,
        categoryId,
        vehicleId: vehicleId || null,
        pickupAt: new Date(pickupAt).toISOString(),
        returnAt: new Date(returnAt).toISOString(),
        pickupBranchId: branchId || null,
        returnBranchId: branchId || null,
        ...form,
        coverages: ["CDW"],
        extraIds,
        licenseFrontImage: licenseImages.frontImageDataUrl || null,
        licenseBackImage: licenseImages.backImageDataUrl || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Αποτυχία κράτησης");
      return;
    }
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
      return;
    }
    router.push(
      data.redirectTo ||
        (partnerToken
          ? `/book/partner/${partnerToken}/success?booking=${data.bookingId}`
          : `/book/${token}/success?booking=${data.bookingId}`)
    );
  }

  const daysPreview = rentalDays(pickupAt, returnAt);
  const roughTotal = (selected?.baseDailyRate || 0) * daysPreview;

  const licenseCheck = useMemo(() => {
    if (!selected || !form.licenseCategories.trim()) return null;
    return checkLicenseForVehicleType({
      vehicleType: selected.vehicleType,
      licenseCategories: form.licenseCategories,
      pickupAt: new Date(pickupAt),
      vehicleTransmission: selected.transmission,
      requireCategories: true,
    });
  }, [selected, form.licenseCategories, pickupAt]);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {cancelled ? (
        <p className="rounded-lg border border-warning/30 bg-amber-50 px-3 py-2 text-sm text-warning">
          Η πληρωμή ακυρώθηκε — μπορείς να δοκιμάσεις ξανά.
        </p>
      ) : null}

      {partnerName ? (
        <p className="rounded-lg border border-accent/25 bg-accent/5 px-3 py-2 text-sm text-ink">
          Τιμές συμφωνίας: <strong>{partnerName}</strong>
        </p>
      ) : null}

      {!paymentsEnabled ? (
        <p className="rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm text-muted">
          Το Stripe δεν είναι ενεργό ακόμη — η κράτηση θα καταχωρηθεί ως
          απλήρωτη (αίτηση). Ο {orgName} θα επικοινωνήσει μαζί σου.
        </p>
      ) : null}

      <Card>
        <h2 className="font-display text-lg">Όχημα & ημερομηνίες</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Κατηγορία</Label>
            <select
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {vehicleTypeLabel(c.vehicleType)} ·{" "}
                  {formatCurrency(c.baseDailyRate)}/ημέρα
                </option>
              ))}
            </select>
          </div>
          {branches.length > 0 ? (
            <div className="sm:col-span-2">
              <Label>Σημείο παραλαβής</Label>
              <select
                className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
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
              onChange={(e) => setReturnAt(e.target.value)}
              required
            />
            {!datesValid ? (
              <p className="mt-1.5 text-xs text-red-600">
                {RETURN_AFTER_PICKUP_MSG}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded-xl bg-accent-soft/60 px-4 py-3 text-sm">
            {checking ? (
              <p className="text-muted">Έλεγχος διαθεσιμότητας…</p>
            ) : availability?.available ? (
              <div>
                <p>
                  <strong>
                    {availability.count ?? availability.vehicles?.length ?? 0}
                  </strong>{" "}
                  διαθέσιμα στην κατηγορία ·{" "}
                  <strong>
                    {formatCurrency(
                      availability.quote?.totalAmount ?? roughTotal
                    )}
                  </strong>{" "}
                  για {availability.quote?.days ?? daysPreview} ημέρες
                  {availability.quote?.depositAmount ? (
                    <span className="text-muted">
                      {" "}
                      · εγγύηση{" "}
                      {formatCurrency(availability.quote.depositAmount)}
                    </span>
                  ) : null}
                </p>
                {availability.quote?.deal ? (
                  <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                    <strong>{availability.quote.deal.badge}:</strong>{" "}
                    {availability.quote.deal.title}
                    {availability.quote.deal.priceLabel
                      ? ` · ${availability.quote.deal.priceLabel}`
                      : ""}
                    {availability.quote.deal.freeDays > 0
                      ? ` · −${availability.quote.deal.freeDays} δωρεάν ημέρα${
                          availability.quote.deal.freeDays > 1 ? "ες" : ""
                        }`
                      : ""}
                    {availability.quote.discountAmount
                      ? ` (−${formatCurrency(availability.quote.discountAmount)})`
                      : ""}
                  </p>
                ) : null}
                <span className="mt-1 block text-xs text-muted">
                  24ώρες = 1 ημέρα · έως +3 ώρες χωρίς έξτρα · &gt;27ώρες = +1
                  ημέρα
                </span>
              </div>
            ) : (
              <p className="text-danger">
                Δεν υπάρχει διαθέσιμο όχημα για αυτές τις ημερομηνίες.
              </p>
            )}
          </div>

          {availability?.available && availability.vehicles?.length ? (
            <div>
              <Label>Επίλεξε όχημα</Label>
              <div className="mt-2 grid gap-2">
                {availability.vehicles.map((v) => (
                  <label
                    key={v.id}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-3 text-sm ${
                      vehicleId === v.id
                        ? "border-accent bg-accent-soft/40"
                        : "border-border bg-surface"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="vehicleId"
                        value={v.id}
                        checked={vehicleId === v.id}
                        onChange={() => setVehicleId(v.id)}
                      />
                      <span>
                        <span className="font-medium">
                          {v.make} {v.model}
                          {v.year ? ` (${v.year})` : ""}
                        </span>
                        {v.branchName ? (
                          <span className="mt-0.5 block text-xs text-muted">
                            {v.branchName}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      {extras.length > 0 ? (
        <Card>
          <h2 className="font-display text-lg">Extras</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
                {e.flatRate != null && e.flatRate > 0
                  ? `${e.flatRate}€`
                  : `${e.dailyRate}€/ημέρα`}
                )
              </label>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg">Στοιχεία οδηγού</h2>
          <LicenseOcrButton
            publicMode
            onImages={setLicenseImages}
            onResult={(fields) =>
              setForm((f) => ({
                ...f,
                firstName: fields.firstName || f.firstName,
                lastName: fields.lastName || f.lastName,
                licenseNumber: fields.licenseNumber || f.licenseNumber,
                licenseCategories:
                  fields.licenseCategories || f.licenseCategories,
                idDocumentNo: fields.idDocumentNo || f.idDocumentNo,
                afm: fields.afm || f.afm,
              }))
            }
          />
        </div>
        {licenseImages.frontImageDataUrl ? (
          <p className="mt-2 text-xs text-emerald-700">
            Οι φωτογραφίες άδειας θα αποθηκευτούν ως PDF μέχρι την επιστροφή του
            οχήματος.
          </p>
        ) : null}
        <p className="mt-3 text-xs text-muted">
          Τα πεδία είναι επεξεργάσιμα — αν το OCR κάνει λάθος, διόρθωσέ τα
          χειροκίνητα πριν την κράτηση.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Όνομα</Label>
            <Input
              required
              value={form.firstName}
              onChange={(e) =>
                setForm((f) => ({ ...f, firstName: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>Επώνυμο</Label>
            <Input
              required
              value={form.lastName}
              onChange={(e) =>
                setForm((f) => ({ ...f, lastName: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>Αρ. διπλώματος</Label>
            <Input
              value={form.licenseNumber}
              onChange={(e) =>
                setForm((f) => ({ ...f, licenseNumber: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>ΑΦΜ (αν έχεις)</Label>
            <Input
              value={form.afm}
              onChange={(e) => setForm((f) => ({ ...f, afm: e.target.value }))}
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              required
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
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
              placeholder="+30…"
            />
          </div>
          <div>
            <Label>Αρ. ταυτότητας / διαβατηρίου</Label>
            <Input
              required
              value={form.idDocumentNo}
              onChange={(e) =>
                setForm((f) => ({ ...f, idDocumentNo: e.target.value }))
              }
            />
          </div>
          <LicenseCategoriesEditor
            value={form.licenseCategories}
            onChange={(licenseCategories) =>
              setForm((f) => ({ ...f, licenseCategories }))
            }
            error={
              licenseCheck && !licenseCheck.ok ? licenseCheck.message : null
            }
          />
          <div>
            <Label>Σημειώσεις</Label>
            <Input
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </div>
        </div>
      </Card>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Button
        type="submit"
        className="w-full sm:w-auto"
        disabled={
          loading ||
          !datesValid ||
          !availability?.available ||
          !vehicleId ||
          Boolean(licenseCheck && !licenseCheck.ok)
        }
      >
        {loading
          ? "Περίμενε…"
          : paymentsEnabled
            ? "Συνέχεια στην πληρωμή"
            : "Υποβολή κράτησης"}
      </Button>
    </form>
  );
}
