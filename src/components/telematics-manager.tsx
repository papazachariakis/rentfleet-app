"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, Input, Label } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

type Vehicle = {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
};

type Device = {
  id: string;
  name: string;
  hardware: string;
  connectivity: string;
  deviceKeyPrefix: string;
  firmware: string | null;
  active: boolean;
  online: boolean;
  lastSeenAt: string | null;
  lastLat: number | null;
  lastLng: number | null;
  lastSpeedKmh: number | null;
  lastFuelPercent: number | null;
  lastOdometerKm: number | null;
  lastEngineRpm: number | null;
  lastCoolantC: number | null;
  lastBatteryV: number | null;
  lastIgnition: boolean | null;
  lastNetwork: string | null;
  lastDtcs: string[];
  vehicle: Vehicle | null;
};

export function TelematicsManager() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [msg, setMsg] = useState("");
  const [newKey, setNewKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    hardware: "ESP32_OBD2",
    connectivity: "WIFI",
    vehicleId: "",
    imei: "",
  });

  async function load() {
    const [d, meta] = await Promise.all([
      fetch("/api/telematics/devices").then((r) => r.json()),
      fetch("/api/bookings/meta").then((r) => r.json()),
    ]);
    setDevices(d.devices || []);
    setVehicles(meta.vehicles || []);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    setNewKey("");
    const res = await fetch("/api/telematics/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        vehicleId: form.vehicleId || null,
        imei: form.imei || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMsg(data.error || "Σφάλμα");
      return;
    }
    setNewKey(data.deviceKey || "");
    setMsg("Συσκευή δημιουργήθηκε — πέρασε το pairing key στον tracker");
    setForm({
      name: "",
      hardware: "ESP32_OBD2",
      connectivity: "WIFI",
      vehicleId: "",
      imei: "",
    });
    load();
  }

  async function unlink(id: string) {
    if (!confirm("Διαγραφή συσκευής;")) return;
    await fetch(`/api/telematics/devices/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <h2 className="font-display text-lg">Νέος tracker</h2>
          <p className="mt-1 text-sm text-muted">
            Σύνδεσε επίσημο RentFleet tracker (WiFi ή 4G/5G) με όχημα για
            θέση, καύσιμο, ταχύτητα και βλάβες.
          </p>
          <form onSubmit={create} className="mt-4 space-y-3">
            <div>
              <Label>Όνομα</Label>
              <Input
                required
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Tracker · ΙΚΑ-1234"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Hardware</Label>
                <select
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
                  value={form.hardware}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, hardware: e.target.value }))
                  }
                >
                  <option value="ESP32_OBD2">OBD2 tracker</option>
                  <option value="ESP32_GPS">GPS tracker</option>
                  <option value="OBD2_DONGLE">OBD2 dongle</option>
                  <option value="OTHER">Άλλο</option>
                </select>
              </div>
              <div>
                <Label>Δίκτυο</Label>
                <select
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
                  value={form.connectivity}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, connectivity: e.target.value }))
                  }
                >
                  <option value="WIFI">WiFi</option>
                  <option value="LTE">4G/LTE</option>
                  <option value="NR">5G/NR</option>
                  <option value="MULTI">WiFi+Cellular</option>
                </select>
              </div>
            </div>
            <div>
              <Label>Όχημα</Label>
              <select
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
                value={form.vehicleId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, vehicleId: e.target.value }))
                }
              >
                <option value="">— σύνδεση αργότερα —</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber} · {v.make} {v.model}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>IMEI (προαιρετικό)</Label>
              <Input
                value={form.imei}
                onChange={(e) =>
                  setForm((f) => ({ ...f, imei: e.target.value }))
                }
              />
            </div>
            <Button type="submit" disabled={loading}>
              Δημιουργία + pairing key
            </Button>
          </form>
          {newKey ? (
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
              <p className="font-medium text-amber-950">
                Pairing key (μία φορά — μόνο για επίσημο tracker):
              </p>
              <code className="mt-1 block break-all text-xs">{newKey}</code>
            </div>
          ) : null}
          {msg ? <p className="mt-2 text-sm text-muted">{msg}</p> : null}
        </Card>
      </div>

      <div className="lg:col-span-3 space-y-3">
        {devices.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">Καμία συσκευή ακόμα.</p>
          </Card>
        ) : (
          devices.map((d) => (
            <Card key={d.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {d.name}{" "}
                    <Badge tone={d.online ? "success" : "neutral"}>
                      {d.online ? "online" : "offline"}
                    </Badge>{" "}
                    <Badge tone="accent">{d.connectivity}</Badge>
                  </p>
                  <p className="text-xs text-muted">
                    {d.hardware} · key {d.deviceKeyPrefix}… ·{" "}
                    {d.vehicle
                      ? `${d.vehicle.plateNumber}`
                      : "χωρίς όχημα"}
                    {d.firmware ? ` · fw ${d.firmware}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-xs text-danger"
                  onClick={() => unlink(d.id)}
                >
                  Διαγραφή
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted">Ταχύτητα</p>
                  <p>{d.lastSpeedKmh != null ? `${d.lastSpeedKmh} km/h` : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Καύσιμο</p>
                  <p>
                    {d.lastFuelPercent != null ? `${d.lastFuelPercent}%` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted">RPM</p>
                  <p>{d.lastEngineRpm ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Μπαταρία</p>
                  <p>
                    {d.lastBatteryV != null ? `${d.lastBatteryV} V` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted">Θερμ. νερού</p>
                  <p>
                    {d.lastCoolantC != null ? `${d.lastCoolantC} °C` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted">Χλμ</p>
                  <p>
                    {d.lastOdometerKm != null
                      ? Math.round(d.lastOdometerKm)
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted">Μίζα</p>
                  <p>
                    {d.lastIgnition == null
                      ? "—"
                      : d.lastIgnition
                        ? "ON"
                        : "OFF"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted">Δίκτυο</p>
                  <p>{d.lastNetwork || "—"}</p>
                </div>
              </div>
              {d.lastDtcs?.length ? (
                <p className="mt-2 text-sm text-danger">
                  Βλάβες DTC: {d.lastDtcs.join(", ")}
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted">Χωρίς ενεργά DTC</p>
              )}
              {d.lastSeenAt ? (
                <p className="mt-1 text-xs text-muted">
                  Τελευταίο σήμα: {formatDateTime(d.lastSeenAt)}
                  {d.lastLat != null
                    ? ` · ${d.lastLat.toFixed(5)}, ${d.lastLng?.toFixed(5)}`
                    : ""}
                </p>
              ) : null}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
