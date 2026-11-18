"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

const FleetMapInner = dynamic(
  () =>
    import("@/components/fleet-map-inner").then((m) => m.FleetMapInner),
  {
    ssr: false,
    loading: () => (
      <p className="rounded-xl border border-border bg-surface p-8 text-sm text-muted">
        Φόρτωση χάρτη…
      </p>
    ),
  }
);

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

export function FleetMap() {
  const [vehicles, setVehicles] = useState<MapVehicle[]>([]);
  const [branches, setBranches] = useState<MapBranch[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/fleet/map");
    if (!res.ok) {
      setError("Αποτυχία φόρτωσης");
      return;
    }
    const data = await res.json();
    setVehicles(data.vehicles || []);
    setBranches(data.branches || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return <p className="text-sm text-danger">{error}</p>;
  }

  return (
    <FleetMapInner vehicles={vehicles} branches={branches} onSaved={load} />
  );
}
