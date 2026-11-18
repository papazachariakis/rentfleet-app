"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Input, Label } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

type Channel = {
  id: string;
  provider: string;
  name: string;
  externalId: string | null;
  icalUrl: string | null;
  status: string;
  lastSyncAt: string | null;
  lastError: string | null;
};

type Vehicle = { id: string; plateNumber: string; make: string; model: string };

export function ChannelsManager() {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    provider: "ICAL",
    name: "",
    externalId: "",
    icalUrl: "",
    notes: "",
  });
  const [imp, setImp] = useState({
    channelId: "",
    externalRef: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    pickupAt: "",
    returnAt: "",
    vehicleId: "",
    totalAmount: "",
  });

  async function load() {
    const [c, meta] = await Promise.all([
      fetch("/api/channels").then((r) => r.json()),
      fetch("/api/bookings/meta").then((r) => r.json()),
    ]);
    setChannels(c.channels || []);
    setVehicles(meta.vehicles || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function createChannel(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    const res = await fetch("/api/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMsg(data.error || "Σφάλμα");
      return;
    }
    setForm({ provider: "ICAL", name: "", externalId: "", icalUrl: "", notes: "" });
    setMsg("Κανάλι προστέθηκε");
    load();
  }

  async function sync(id: string) {
    setLoading(true);
    setMsg("");
    const res = await fetch(`/api/channels/${id}/sync`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMsg(data.error || "Sync απέτυχε");
      return;
    }
    setMsg(
      `Sync OK · ${data.created} νέες · ${data.skipped} υπάρχουσες · ${data.events} events`
    );
    load();
    router.refresh();
  }

  async function importBooking(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    const res = await fetch("/api/channels/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...imp,
        vehicleId: imp.vehicleId || null,
        totalAmount: imp.totalAmount ? Number(imp.totalAmount) : undefined,
        pickupAt: new Date(imp.pickupAt).toISOString(),
        returnAt: new Date(imp.returnAt).toISOString(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMsg(data.error || "Σφάλμα import");
      return;
    }
    setMsg(`Εισήχθη κράτηση ${data.booking?.code}`);
    router.push(`/bookings/${data.booking.id}`);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <Card>
          <h2 className="font-display text-lg">Νέο κανάλι / OTA</h2>
          <p className="mt-1 text-sm text-muted">
            iCal sync τώρα · Booking/Airbnb/Expedia μέσω calendar export URL ή
            χειροκίνητο import. Native API connectors σε επόμενο βήμα.
          </p>
          <form onSubmit={createChannel} className="mt-4 space-y-3">
            <div>
              <Label>Πάροχος</Label>
              <select
                className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
                value={form.provider}
                onChange={(e) =>
                  setForm((f) => ({ ...f, provider: e.target.value }))
                }
              >
                {["ICAL", "BOOKING", "AIRBNB", "EXPEDIA", "CUSTOM"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Όνομα</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Booking.com Ηράκλειο"
                required
              />
            </div>
            <div>
              <Label>iCal / calendar URL</Label>
              <Input
                value={form.icalUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, icalUrl: e.target.value }))
                }
                placeholder="https://…/calendar.ics"
              />
            </div>
            <div>
              <Label>External ID (προαιρετικό)</Label>
              <Input
                value={form.externalId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, externalId: e.target.value }))
                }
              />
            </div>
            <Button type="submit" disabled={loading}>
              Προσθήκη
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="font-display text-lg">Χειροκίνητο import</h2>
          <form onSubmit={importBooking} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Κανάλι</Label>
              <select
                className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
                value={imp.channelId}
                onChange={(e) =>
                  setImp((f) => ({ ...f, channelId: e.target.value }))
                }
              >
                <option value="">—</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.provider})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>OTA ref</Label>
              <Input
                value={imp.externalRef}
                onChange={(e) =>
                  setImp((f) => ({ ...f, externalRef: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <Label>Όχημα</Label>
              <select
                className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
                value={imp.vehicleId}
                onChange={(e) =>
                  setImp((f) => ({ ...f, vehicleId: e.target.value }))
                }
              >
                <option value="">Χωρίς / αργότερα</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber} · {v.make} {v.model}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Όνομα</Label>
              <Input
                value={imp.firstName}
                onChange={(e) =>
                  setImp((f) => ({ ...f, firstName: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <Label>Επώνυμο</Label>
              <Input
                value={imp.lastName}
                onChange={(e) =>
                  setImp((f) => ({ ...f, lastName: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <Label>Παραλαβή</Label>
              <Input
                type="datetime-local"
                value={imp.pickupAt}
                onChange={(e) =>
                  setImp((f) => ({ ...f, pickupAt: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <Label>Επιστροφή</Label>
              <Input
                type="datetime-local"
                value={imp.returnAt}
                onChange={(e) =>
                  setImp((f) => ({ ...f, returnAt: e.target.value }))
                }
                required
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={loading}>
                Εισαγωγή κράτησης
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <Card>
        <h2 className="font-display text-lg">Συνδεδεμένα κανάλια</h2>
        {msg ? <p className="mt-2 text-sm text-muted">{msg}</p> : null}
        {channels.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Κανένα ακόμα.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border text-sm">
            {channels.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div>
                  <p className="font-medium">
                    {c.name}{" "}
                    <Badge tone="accent">{c.provider}</Badge>{" "}
                    <Badge
                      tone={
                        c.status === "ERROR"
                          ? "danger"
                          : c.status === "ACTIVE"
                            ? "success"
                            : "neutral"
                      }
                    >
                      {c.status}
                    </Badge>
                  </p>
                  <p className="text-xs text-muted">
                    {c.lastSyncAt
                      ? `Τελευταίο sync: ${formatDateTime(c.lastSyncAt)}`
                      : "Δεν έχει γίνει sync"}
                    {c.lastError ? ` · ${c.lastError}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="text-xs"
                  disabled={loading || !c.icalUrl}
                  onClick={() => sync(c.id)}
                >
                  Sync τώρα
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
