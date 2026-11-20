"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Badge,
  Button,
  DataTable,
  TBody,
  THead,
  Td,
  Th,
} from "@/components/ui";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export type BookingListItem = {
  id: string;
  code: string | null;
  status: string;
  paymentStatus: string;
  aadeLedgerStatus: string;
  totalAmount: number;
  pickupAt: string;
  customerName: string;
  vehicleLabel: string | null;
};

function canCancel(status: string) {
  return (
    status === "DRAFT" ||
    status === "PENDING_PAYMENT" ||
    status === "CONFIRMED" ||
    status === "CHECKED_OUT"
  );
}

function canDelete(status: string) {
  return (
    status === "DRAFT" || status === "CANCELLED" || status === "NO_SHOW"
  );
}

export function BookingsList({ bookings }: { bookings: BookingListItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  async function cancel(id: string, code: string | null, status: string) {
    const checkedOutWarn =
      status === "CHECKED_OUT"
        ? " Το όχημα είναι ήδη σε παραλαβή — θα ελευθερωθεί."
        : "";
    if (
      !confirm(`Ακύρωση κράτησης ${code || ""};${checkedOutWarn}`.trim())
    ) {
      return;
    }
    setBusyId(id);
    setMsg("");
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setMsg(data.error || "Αποτυχία ακύρωσης");
      return;
    }
    router.refresh();
  }

  async function remove(id: string, code: string | null) {
    if (
      !confirm(
        `Οριστική διαγραφή της κράτησης ${code || ""}; Δεν αναιρείται.`.trim()
      )
    ) {
      return;
    }
    setBusyId(id);
    setMsg("");
    const res = await fetch(`/api/bookings/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setMsg(data.error || "Αποτυχία διαγραφής");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {msg ? <p className="text-sm text-danger">{msg}</p> : null}
      <DataTable>
        <THead>
          <tr>
            <Th>Κωδικός</Th>
            <Th>Πελάτης</Th>
            <Th>Όχημα</Th>
            <Th>Παραλαβή</Th>
            <Th>Κατάσταση</Th>
            <Th>Πληρωμή</Th>
            <Th>ΑΑΔΕ</Th>
            <Th>Ποσό</Th>
            <Th className="text-right">Ενέργειες</Th>
          </tr>
        </THead>
        <TBody>
          {bookings.map((b) => {
            const busy = busyId === b.id;
            return (
              <tr key={b.id} className="transition hover:bg-slate-50/80">
                <Td className="font-medium">
                  <Link
                    href={`/bookings/${b.id}`}
                    className="text-accent hover:underline"
                  >
                    {b.code || "—"}
                  </Link>
                </Td>
                <Td>{b.customerName}</Td>
                <Td>{b.vehicleLabel || "—"}</Td>
                <Td>{formatDateTime(b.pickupAt)}</Td>
                <Td>
                  <Badge tone="accent">{b.status}</Badge>
                </Td>
                <Td>
                  <Badge
                    tone={b.paymentStatus === "PAID" ? "success" : "warning"}
                  >
                    {b.paymentStatus}
                  </Badge>
                </Td>
                <Td>
                  <Badge
                    tone={
                      b.aadeLedgerStatus === "OK"
                        ? "success"
                        : b.aadeLedgerStatus === "FAILED"
                          ? "danger"
                          : "neutral"
                    }
                  >
                    {b.aadeLedgerStatus}
                  </Badge>
                </Td>
                <Td>{formatCurrency(b.totalAmount)}</Td>
                <Td>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {canCancel(b.status) ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => void cancel(b.id, b.code, b.status)}
                      >
                        Ακύρωση
                      </Button>
                    ) : null}
                    {canDelete(b.status) ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => void remove(b.id, b.code)}
                      >
                        Διαγραφή
                      </Button>
                    ) : null}
                  </div>
                </Td>
              </tr>
            );
          })}
        </TBody>
      </DataTable>
    </div>
  );
}
