"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  CircleMarker,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button, Badge } from "@/components/ui";
import { vehicleTypeLabel, formatDateTime } from "@/lib/utils";
import Link from "next/link";

type MapVehicle = {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  vehicleType: string;
  status: string;
  lat: number | null;
  lng: number | null;
  mapLat: number | null;
  mapLng: number | null;
  locationSource: "telematics" | "vehicle" | "branch" | null;
  locationLabel: string | null;
  locationUpdatedAt: string | null;
  branch: { id: string; name: string } | null;
  telematics?: {
    online: boolean;
    speedKmh: number | null;
    fuelPercent: number | null;
    ignition: boolean | null;
    network: string | null;
    dtcs: string[];
    lastSeenAt: string | null;
  } | null;
};

type MapBranch = {
  id: string;
  name: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
};

const statusColor: Record<string, string> = {
  AVAILABLE: "#2d8a5e",
  RENTED: "#1b6ca8",
  MAINTENANCE: "#d97706",
  BLOCKED: "#c45c4a",
  OUT_OF_SERVICE: "#5a6b7d",
};

function markerIcon(status: string) {
  const color = statusColor[status] || "#1b6ca8";
  return L.divIcon({
    className: "",
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function ClickToPlace({
  enabled,
  onPick,
}: {
  enabled: boolean;
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function FleetMapInner({
  vehicles,
  branches,
  onSaved,
}: {
  vehicles: MapVehicle[];
  branches: MapBranch[];
  onSaved: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placeMode, setPlaceMode] = useState(false);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const positioned = vehicles.filter((v) => v.mapLat != null && v.mapLng != null);
  const missing = vehicles.filter((v) => v.mapLat == null || v.mapLng == null);

  const center = useMemo<[number, number]>(() => {
    if (positioned.length) {
      const lat =
        positioned.reduce((s, v) => s + (v.mapLat as number), 0) /
        positioned.length;
      const lng =
        positioned.reduce((s, v) => s + (v.mapLng as number), 0) /
        positioned.length;
      return [lat, lng];
    }
    const withBranch = branches.filter((b) => b.lat != null && b.lng != null);
    if (withBranch.length) {
      return [withBranch[0].lat as number, withBranch[0].lng as number];
    }
    // Κρήτη / Ελλάδα default
    return [35.3387, 25.1442];
  }, [positioned, branches]);

  async function saveLocation(vehicleId: string, lat: number, lng: number) {
    setSaving(true);
    setMsg("");
    const res = await fetch(`/api/fleet/${vehicleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat,
        lng,
        locationLabel: "Χειροκίνητα στον χάρτη",
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setMsg("Αποτυχία αποθήκευσης θέσης");
      return;
    }
    setMsg("Θέση αποθηκεύτηκε");
    setPlaceMode(false);
    onSaved();
  }

  async function locateWithGps(vehicleId: string) {
    if (!navigator.geolocation) {
      setMsg("GPS μη διαθέσιμο");
      return;
    }
    setSaving(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await saveLocation(vehicleId, pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setSaving(false);
        setMsg("Δεν δόθηκε άδεια GPS");
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  useEffect(() => {
    // Fix default leaflet icon paths in bundlers (we use divIcon anyway)
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone="success">AVAILABLE</Badge>
        <Badge tone="accent">RENTED</Badge>
        <Badge tone="warning">MAINTENANCE</Badge>
        <Badge tone="danger">BLOCKED</Badge>
        <span className="text-muted">
          {positioned.length}/{vehicles.length} με θέση
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <MapContainer
          center={center}
          zoom={positioned.length ? 11 : 8}
          style={{ height: 480, width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToPlace
            enabled={placeMode && Boolean(selectedId)}
            onPick={(lat, lng) => {
              if (selectedId) saveLocation(selectedId, lat, lng);
            }}
          />
          {branches
            .filter((b) => b.lat != null && b.lng != null)
            .map((b) => (
              <CircleMarker
                key={`b-${b.id}`}
                center={[b.lat as number, b.lng as number]}
                radius={10}
                pathOptions={{
                  color: "#0f1c2e",
                  fillColor: "#94a3b8",
                  fillOpacity: 0.5,
                }}
              >
                <Popup>
                  <strong>{b.name}</strong>
                  <br />
                  Κατάστημα{b.city ? ` · ${b.city}` : ""}
                </Popup>
              </CircleMarker>
            ))}
          {positioned.map((v) => (
            <Marker
              key={v.id}
              position={[v.mapLat as number, v.mapLng as number]}
              icon={markerIcon(v.status)}
              eventHandlers={{
                click: () => setSelectedId(v.id),
              }}
            >
              <Popup>
                <div className="space-y-1 text-sm">
                  <p className="font-medium">
                    {v.plateNumber} · {v.make} {v.model}
                  </p>
                  <p>
                    {vehicleTypeLabel(v.vehicleType)} · {v.status}
                  </p>
                  {v.locationSource === "branch" ? (
                    <p className="text-xs text-amber-700">
                      Θέση καταστήματος (όχι GPS οχήματος)
                    </p>
                  ) : null}
                  {v.telematics ? (
                    <div className="mt-1 space-y-0.5 text-xs">
                      <p>
                        Tracker{" "}
                        {v.telematics.online ? (
                          <span className="text-emerald-700">online</span>
                        ) : (
                          <span className="text-muted">offline</span>
                        )}
                        {v.telematics.network
                          ? ` · ${v.telematics.network}`
                          : ""}
                      </p>
                      {v.telematics.speedKmh != null ? (
                        <p>{v.telematics.speedKmh} km/h</p>
                      ) : null}
                      {v.telematics.fuelPercent != null ? (
                        <p>Καύσιμο {v.telematics.fuelPercent}%</p>
                      ) : null}
                      {v.telematics.dtcs?.length ? (
                        <p className="text-red-700">
                          Βλάβες: {v.telematics.dtcs.join(", ")}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {v.locationUpdatedAt ? (
                    <p className="text-xs text-muted">
                      Ενημ. {formatDateTime(v.locationUpdatedAt)}
                    </p>
                  ) : null}
                  <Link
                    href={`/telematics`}
                    className="text-xs text-accent underline"
                  >
                    Trackers
                  </Link>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="font-display text-base">Ορισμός θέσης</h3>
        <p className="mt-1 text-sm text-muted">
          Επίλεξε όχημα → «Τοποθέτηση στον χάρτη» και κλικ στο σημείο, ή GPS
          συσκευής.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            className="min-w-[220px] rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            value={selectedId || ""}
            onChange={(e) => setSelectedId(e.target.value || null)}
          >
            <option value="">— όχημα —</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plateNumber} · {v.status}
                {v.mapLat == null ? " (χωρίς θέση)" : ""}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant={placeMode ? "primary" : "secondary"}
            disabled={!selectedId || saving}
            onClick={() => setPlaceMode((p) => !p)}
          >
            {placeMode ? "Κλικ στον χάρτη…" : "Τοποθέτηση στον χάρτη"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!selectedId || saving}
            onClick={() => selectedId && locateWithGps(selectedId)}
          >
            GPS τώρα
          </Button>
        </div>
        {msg ? <p className="mt-2 text-sm text-muted">{msg}</p> : null}
        {missing.length > 0 ? (
          <p className="mt-3 text-xs text-muted">
            Χωρίς συντεταγμένες:{" "}
            {missing.map((v) => v.plateNumber).join(", ")}. Όρισε lat/lng στο
            κατάστημα ή τοποθέτησε κάθε όχημα.
          </p>
        ) : null}
      </div>
    </div>
  );
}
