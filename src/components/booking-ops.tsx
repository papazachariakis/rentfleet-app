"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label, Badge } from "@/components/ui";
import {
  ensureReturnAfterPickup,
  isReturnAfterPickup,
  RETURN_AFTER_PICKUP_MSG,
} from "@/lib/utils";

type VehicleOption = {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
};

type Props = {
  bookingId: string;
  status: string;
  aadeLedgerId: string | null;
  aadeLedgerStatus: string;
  mydataStatus?: string;
  agreementSigned: boolean;
  customerName: string;
  defaultOdometer?: number | null;
  defaultFuel?: string | null;
  pickupAt: string;
  returnAt: string;
  vehicleId: string | null;
  vehicles?: VehicleOption[];
  failedInvoiceId?: string | null;
};

async function filesToDataUrls(files: FileList | null, max = 6) {
  if (!files?.length) return [] as string[];
  const list = Array.from(files).slice(0, max);
  const urls: string[] = [];
  for (const file of list) {
    if (file.size > 1_500_000) continue;
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    urls.push(data);
  }
  return urls;
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BookingOps({
  bookingId,
  status,
  aadeLedgerId,
  aadeLedgerStatus,
  mydataStatus,
  agreementSigned,
  customerName,
  defaultOdometer,
  defaultFuel,
  pickupAt,
  returnAt,
  vehicleId,
  vehicles = [],
  failedInvoiceId,
}: Props) {
  const router = useRouter();
  const [odometerKm, setOdometerKm] = useState(String(defaultOdometer ?? ""));
  const [fuelLevel, setFuelLevel] = useState(defaultFuel || "Full");
  const [notes, setNotes] = useState("");
  const [damageNotes, setDamageNotes] = useState("");
  const [signerName, setSignerName] = useState(customerName);
  const [pickup, setPickup] = useState(toLocalInput(pickupAt));
  const [ret, setRet] = useState(toLocalInput(returnAt));
  const [vehId, setVehId] = useState(vehicleId || "");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const canEdit =
    status === "DRAFT" ||
    status === "PENDING_PAYMENT" ||
    status === "CONFIRMED";
  const canCancel = canEdit;
  const canRetryLedger =
    (status === "CHECKED_OUT" || status === "CHECKED_IN") &&
    (aadeLedgerStatus === "FAILED" || aadeLedgerStatus === "PENDING");

  async function run(
    path: "checkout" | "checkin" | "agreement",
    extra?: Record<string, unknown>
  ) {
    setLoading(true);
    setMsg("");
    const photos = await filesToDataUrls(photoRef.current?.files || null);
    const res = await fetch(`/api/bookings/${bookingId}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        odometerKm: odometerKm ? Number(odometerKm) : undefined,
        fuelLevel,
        notes,
        damageNotes,
        photos,
        ...extra,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMsg(data.error || "Σφάλμα");
      return;
    }
    if (path === "checkout" && data.ledger?.ledgerId) {
      setMsg(`Παραλαβή OK · ΑΑΔΕ: ${data.ledger.ledgerId}`);
    } else if (path === "checkin") {
      const invNo = data.invoice?.invoice?.number;
      setMsg(
        invNo
          ? `Επιστροφή OK · ΑΑΔΕ + παραστατικό ${invNo}`
          : "Επιστροφή OK · ΑΑΔΕ ενημερώθηκε"
      );
    } else {
      setMsg("Υπογραφή καταχωρήθηκε");
    }
    if (photoRef.current) photoRef.current.value = "";
    router.refresh();
  }

  async function patch(body: Record<string, unknown>, okMsg: string) {
    setLoading(true);
    setMsg("");
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMsg(data.error || "Σφάλμα");
      return;
    }
    setMsg(okMsg);
    router.refresh();
  }

  async function retryLedger() {
    setLoading(true);
    setMsg("");
    const res = await fetch(`/api/bookings/${bookingId}/ledger/retry`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMsg(data.error || "Σφάλμα ΑΑΔΕ");
      return;
    }
    setMsg(
      data.ledger?.ok
        ? `ΑΑΔΕ ${data.kind} OK${data.ledger.ledgerId ? ` · ${data.ledger.ledgerId}` : ""}`
        : data.ledger?.error || "ΑΑΔΕ απέτυχε ξανά"
    );
    router.refresh();
  }

  async function retryInvoice() {
    if (!failedInvoiceId) return;
    setLoading(true);
    setMsg("");
    const res = await fetch(`/api/tax/invoices/${failedInvoiceId}/retry`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMsg(data.error || "Σφάλμα myDATA");
      return;
    }
    setMsg(
      data.invoice?.mydataStatus === "SENT" ||
        data.invoice?.mydataStatus === "OFFLINE"
        ? `myDATA OK · ${data.invoice.number}`
        : data.invoice?.errorMessage || "Επανυποβολή ολοκληρώθηκε"
    );
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-lg">Desk ops</h2>
          <Badge tone="accent">{status}</Badge>
          <Badge
            tone={
              aadeLedgerStatus === "OK"
                ? "success"
                : aadeLedgerStatus === "FAILED"
                  ? "danger"
                  : "neutral"
            }
          >
            ΑΑΔΕ {aadeLedgerStatus}
          </Badge>
          {mydataStatus ? (
            <Badge
              tone={
                mydataStatus === "OK"
                  ? "success"
                  : mydataStatus === "FAILED"
                    ? "danger"
                    : "neutral"
              }
            >
              myDATA {mydataStatus}
            </Badge>
          ) : null}
          {aadeLedgerId ? (
            <span className="text-xs text-muted">{aadeLedgerId}</span>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Χιλιόμετρα</Label>
            <Input
              type="number"
              value={odometerKm}
              onChange={(e) => setOdometerKm(e.target.value)}
            />
          </div>
          <div>
            <Label>Καύσιμο</Label>
            <select
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
              value={fuelLevel}
              onChange={(e) => setFuelLevel(e.target.value)}
            >
              {["Full", "3/4", "1/2", "1/4", "Empty"].map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Σημειώσεις ελέγχου</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Ζημιές</Label>
            <Input
              value={damageNotes}
              onChange={(e) => setDamageNotes(e.target.value)}
              placeholder="π.χ. γρατζουνιά δεξί φτερό"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Φωτογραφίες (έως 6, max ~1.5MB)</Label>
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              multiple
              className="mt-1 block w-full text-sm"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(status === "CONFIRMED" || status === "DRAFT") && (
            <Button
              type="button"
              disabled={loading}
              onClick={() => run("checkout")}
            >
              Παραλαβή (check-out) + ΑΑΔΕ
            </Button>
          )}
          {status === "CHECKED_OUT" && (
            <Button
              type="button"
              disabled={loading}
              onClick={() => run("checkin", { documentType: "ALP" })}
            >
              Επιστροφή (check-in) + ΑΑΔΕ
            </Button>
          )}
          {canRetryLedger && (
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={retryLedger}
            >
              Retry ΑΑΔΕ πελατολόγιο
            </Button>
          )}
          {failedInvoiceId && (
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={retryInvoice}
            >
              Retry myDATA
            </Button>
          )}
        </div>
      </Card>

      {canEdit ? (
        <Card>
          <h2 className="font-display text-lg">Αλλαγή / ακύρωση</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Παραλαβή</Label>
              <Input
                type="datetime-local"
                value={pickup}
                onChange={(e) => {
                  const next = e.target.value;
                  setPickup(next);
                  setRet((prev) => ensureReturnAfterPickup(next, prev));
                }}
              />
            </div>
            <div>
              <Label>Επιστροφή</Label>
              <Input
                type="datetime-local"
                value={ret}
                min={pickup}
                onChange={(e) => setRet(e.target.value)}
              />
              {!isReturnAfterPickup(pickup, ret) ? (
                <p className="mt-1.5 text-xs text-red-600">
                  {RETURN_AFTER_PICKUP_MSG}
                </p>
              ) : null}
            </div>
            {vehicles.length > 0 ? (
              <div className="sm:col-span-2">
                <Label>Όχημα</Label>
                <select
                  className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
                  value={vehId}
                  onChange={(e) => setVehId(e.target.value)}
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plateNumber} · {v.make} {v.model}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={loading || !isReturnAfterPickup(pickup, ret)}
              onClick={() => {
                if (!isReturnAfterPickup(pickup, ret)) {
                  setMsg(RETURN_AFTER_PICKUP_MSG);
                  return;
                }
                patch(
                  {
                    action: "reschedule",
                    pickupAt: new Date(pickup).toISOString(),
                    returnAt: new Date(ret).toISOString(),
                    vehicleId: vehId || null,
                  },
                  "Ενημερώθηκε"
                );
              }}
            >
              Αποθήκευση αλλαγών
            </Button>
            {canCancel ? (
              <>
                <Button
                  type="button"
                  variant="danger"
                  disabled={loading}
                  onClick={() => {
                    if (!confirm("Ακύρωση κράτησης;")) return;
                    patch({ action: "cancel" }, "Ακυρώθηκε");
                  }}
                >
                  Ακύρωση
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading}
                  onClick={() => {
                    if (!confirm("Σήμανση ως no-show;")) return;
                    patch({ action: "no_show" }, "No-show");
                  }}
                >
                  No-show
                </Button>
              </>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Card>
        <h2 className="font-display text-lg">Σύμβαση &amp; GDPR</h2>
        <p className="mt-1 text-sm text-muted">
          {agreementSigned
            ? "Υπογεγραμμένο — κατέβασε / εκτύπωσε το πακέτο"
            : "Εκτύπωση για υπογραφή στο desk · ή ηλεκτρονική υπογραφή"}
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <a
            href={`/api/bookings/${bookingId}/print-pack`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-accent px-3 py-1.5 font-medium text-white hover:bg-accent-dark"
          >
            Εκτύπωση για υπογραφή
          </a>
          <a
            href={`/api/bookings/${bookingId}/agreement/pdf`}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-accent hover:underline"
          >
            Σύμβαση PDF
          </a>
          <a
            href={`/api/bookings/${bookingId}/gdpr/pdf`}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-accent hover:underline"
          >
            GDPR PDF
          </a>
          <a
            href={`/api/bookings/${bookingId}/agreement/pdf?format=html`}
            target="_blank"
            rel="noreferrer"
            className="text-muted hover:underline"
          >
            Σύμβαση HTML
          </a>
        </div>
        {!agreementSigned ? (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label>Ονοματεπώνυμο υπογράφοντα</Label>
              <Input
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
              />
            </div>
            <Button
              type="button"
              disabled={loading || signerName.trim().length < 2}
              onClick={() => run("agreement", { signerName })}
            >
              Υπογραφή
            </Button>
          </div>
        ) : (
          <div className="mt-3">
            <Badge tone="success">Υπογεγραμμένο</Badge>
          </div>
        )}
      </Card>

      {msg ? <p className="text-sm text-muted">{msg}</p> : null}
    </div>
  );
}
