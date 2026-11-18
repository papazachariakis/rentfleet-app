"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cn, vehicleTypeLabel } from "@/lib/utils";

type Vehicle = {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  vehicleType: string;
  status: string;
};

type Booking = {
  id: string;
  code: string | null;
  status: string;
  pickupAt: string;
  returnAt: string;
  vehicleId: string | null;
  customer: { firstName: string; lastName: string };
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function overlapsDay(pickup: Date, ret: Date, day: Date) {
  const a = startOfDay(day).getTime();
  const b = addDays(startOfDay(day), 1).getTime();
  return pickup.getTime() < b && ret.getTime() > a;
}

function isWeekend(d: Date) {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function bookingCellClass(status: string) {
  switch (status) {
    case "CHECKED_OUT":
      return "bg-sky-600 text-white";
    case "CHECKED_IN":
      return "bg-emerald-600 text-white";
    case "PENDING_PAYMENT":
      return "bg-amber-500 text-white";
    case "CONFIRMED":
      return "bg-teal-700 text-white";
    case "CANCELLED":
    case "NO_SHOW":
      return "bg-slate-400 text-white";
    default:
      return "bg-indigo-600 text-white";
  }
}

function freeCellClass(vehicleStatus: string, weekend: boolean) {
  if (vehicleStatus === "MAINTENANCE") {
    return weekend ? "bg-orange-100/90" : "bg-orange-50";
  }
  if (vehicleStatus === "BLOCKED" || vehicleStatus === "OUT_OF_SERVICE") {
    return weekend ? "bg-rose-100/80" : "bg-rose-50";
  }
  if (vehicleStatus === "RENTED") {
    return weekend ? "bg-sky-100/70" : "bg-sky-50/80";
  }
  return weekend ? "bg-slate-100" : "bg-emerald-50/70";
}

function typeRowTint(type: string) {
  switch (type) {
    case "MOTO":
      return "border-l-4 border-l-violet-400";
    case "SCOOTER":
      return "border-l-4 border-l-fuchsia-400";
    case "VAN":
      return "border-l-4 border-l-amber-500";
    default:
      return "border-l-4 border-l-sky-500";
  }
}

export function FleetCalendar({
  vehicles,
  bookings,
}: {
  vehicles: Vehicle[];
  bookings: Booking[];
}) {
  const [offset, setOffset] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const daysCount = 14;

  const days = useMemo(() => {
    const start = addDays(startOfDay(new Date()), offset);
    return Array.from({ length: daysCount }, (_, i) => addDays(start, i));
  }, [offset]);

  const byVehicle = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      if (!b.vehicleId) continue;
      const list = map.get(b.vehicleId) || [];
      list.push(b);
      map.set(b.vehicleId, list);
    }
    return map;
  }, [bookings]);

  const filtered = useMemo(
    () =>
      typeFilter === "ALL"
        ? vehicles
        : vehicles.filter((v) => v.vehicleType === typeFilter),
    [vehicles, typeFilter]
  );

  const catalogTabs = [
    { id: "ALL", label: "Όλα" },
    { id: "CAR", label: "Αυτοκίνητα" },
    { id: "MOTO", label: "Μοτοσυκλέτες" },
    { id: "SCOOTER", label: "Σκούτερ" },
    { id: "VAN", label: "Van" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:bg-slate-50"
            onClick={() => setOffset((o) => o - 7)}
          >
            ← 7 ημέρες
          </button>
          <button
            type="button"
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:bg-slate-50"
            onClick={() => setOffset(0)}
          >
            Σήμερα
          </button>
          <button
            type="button"
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:bg-slate-50"
            onClick={() => setOffset((o) => o + 7)}
          >
            7 ημέρες →
          </button>
        </div>
        <p className="text-xs text-muted">
          {days[0].toLocaleDateString("el-GR")} –{" "}
          {days[days.length - 1].toLocaleDateString("el-GR")}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {catalogTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTypeFilter(t.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition",
              typeFilter === t.id
                ? "bg-ink text-white"
                : "border border-border bg-surface text-muted hover:bg-slate-50"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[900px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border bg-slate-50">
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 font-medium">
                Όχημα
              </th>
              {days.map((d) => {
                const isToday =
                  startOfDay(d).getTime() === startOfDay(new Date()).getTime();
                const weekend = isWeekend(d);
                return (
                  <th
                    key={d.toISOString()}
                    className={cn(
                      "min-w-[64px] px-1 py-2 text-center font-medium",
                      weekend && !isToday && "bg-violet-50 text-violet-900",
                      isToday && "bg-accent-soft text-accent"
                    )}
                  >
                    <div>
                      {d.toLocaleDateString("el-GR", { weekday: "short" })}
                    </div>
                    <div className="text-[11px] font-normal text-muted">
                      {d.getDate()}/{d.getMonth() + 1}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={daysCount + 1}
                  className="px-3 py-6 text-center text-muted"
                >
                  Δεν υπάρχουν οχήματα σε αυτόν τον κατάλογο
                </td>
              </tr>
            ) : (
              filtered.map((v) => {
                const vBookings = byVehicle.get(v.id) || [];
                return (
                  <tr
                    key={v.id}
                    className={cn(
                      "border-b border-border/70",
                      typeRowTint(v.vehicleType)
                    )}
                  >
                    <td className="sticky left-0 z-10 bg-surface px-3 py-2">
                      <p className="font-medium">{v.plateNumber}</p>
                      <p className="text-[11px] text-muted">
                        {v.make} {v.model} · {vehicleTypeLabel(v.vehicleType)}
                      </p>
                    </td>
                    {days.map((d) => {
                      const weekend = isWeekend(d);
                      const hits = vBookings.filter((b) =>
                        overlapsDay(
                          new Date(b.pickupAt),
                          new Date(b.returnAt),
                          d
                        )
                      );
                      const hit = hits[0];
                      return (
                        <td
                          key={`${v.id}-${d.toISOString()}`}
                          className="px-0.5 py-1 align-middle"
                        >
                          {hit ? (
                            <Link
                              href={`/bookings/${hit.id}`}
                              title={`${hit.code || ""} · ${hit.customer.firstName} ${hit.customer.lastName} · ${hit.status}`}
                              className={cn(
                                "mx-auto block max-w-[58px] truncate rounded px-1 py-2 text-center text-[10px] font-medium shadow-sm",
                                bookingCellClass(hit.status)
                              )}
                            >
                              {hit.customer.lastName.slice(0, 6)}
                            </Link>
                          ) : (
                            <div
                              title={
                                v.status === "AVAILABLE"
                                  ? "Διαθέσιμο"
                                  : v.status
                              }
                              className={cn(
                                "mx-auto h-8 max-w-[58px] rounded",
                                freeCellClass(v.status, weekend)
                              )}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-teal-700" /> Επιβεβαιωμένη
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-sky-600" /> Σε ενοικίαση
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-emerald-600" /> Επιστροφή
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-amber-500" /> Αναμονή πληρωμής
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-emerald-50 ring-1 ring-emerald-200" />{" "}
          Ελεύθερο
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-orange-50 ring-1 ring-orange-200" />{" "}
          Service
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-violet-50 ring-1 ring-violet-200" />{" "}
          Σαβ/Κυρ
        </span>
      </div>
    </div>
  );
}
