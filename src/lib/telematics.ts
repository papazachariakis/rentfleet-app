import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export function hashDeviceKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function generateDeviceKey() {
  const key = `rf_tel_${randomBytes(24).toString("base64url")}`;
  return {
    key,
    hash: hashDeviceKey(key),
    prefix: key.slice(0, 12),
  };
}

export type TelemetryIngestBody = {
  ts?: string;
  gps?: {
    lat?: number;
    lng?: number;
    alt?: number;
    hdop?: number;
    satellites?: number;
  };
  speed_kmh?: number;
  fuel_percent?: number;
  /** 0–1 ή 0–100 — κανονικοποιείται σε % */
  fuel_level?: number;
  odometer_km?: number;
  rpm?: number;
  coolant_c?: number;
  battery_v?: number;
  ignition?: boolean;
  dtcs?: string[];
  pids?: Record<string, unknown>;
  network?: { type?: string; rssi?: number };
  firmware?: string;
  /** οποιαδήποτε επιπλέον πεδία */
  extras?: Record<string, unknown>;
};

export function normalizeFuelPercent(v?: number | null) {
  if (v == null || Number.isNaN(v)) return null;
  if (v <= 1) return Math.round(v * 1000) / 10;
  return Math.min(100, Math.max(0, Math.round(v * 10) / 10));
}

export async function ingestTelemetry(
  deviceKey: string,
  body: TelemetryIngestBody
) {
  const device = await prisma.telematicsDevice.findFirst({
    where: {
      deviceKeyHash: hashDeviceKey(deviceKey),
      active: true,
    },
    include: { vehicle: true },
  });
  if (!device) throw new Error("UNAUTHORIZED_DEVICE");

  const recordedAt = body.ts ? new Date(body.ts) : new Date();
  const lat = body.gps?.lat ?? null;
  const lng = body.gps?.lng ?? null;
  const fuel =
    normalizeFuelPercent(body.fuel_percent) ??
    normalizeFuelPercent(body.fuel_level);
  const dtcsJson = body.dtcs?.length ? JSON.stringify(body.dtcs) : null;
  const extras = {
    ...(body.pids || {}),
    ...(body.extras || {}),
    ...(body.gps?.alt != null ? { gps_alt: body.gps.alt } : {}),
    ...(body.gps?.hdop != null ? { gps_hdop: body.gps.hdop } : {}),
    ...(body.gps?.satellites != null
      ? { gps_satellites: body.gps.satellites }
      : {}),
  };
  const extrasJson =
    Object.keys(extras).length > 0 ? JSON.stringify(extras) : null;
  const networkType = body.network?.type || null;
  const rssi = body.network?.rssi ?? null;

  const reading = await prisma.telematicsReading.create({
    data: {
      deviceId: device.id,
      recordedAt,
      lat,
      lng,
      speedKmh: body.speed_kmh ?? null,
      fuelPercent: fuel,
      odometerKm: body.odometer_km ?? null,
      engineRpm: body.rpm ?? null,
      coolantC: body.coolant_c ?? null,
      batteryV: body.battery_v ?? null,
      ignition: body.ignition ?? null,
      dtcsJson,
      extrasJson,
      networkType,
      rssi,
      rawJson: JSON.stringify(body).slice(0, 8000),
    },
  });

  await prisma.telematicsDevice.update({
    where: { id: device.id },
    data: {
      lastSeenAt: recordedAt,
      lastLat: lat ?? undefined,
      lastLng: lng ?? undefined,
      lastSpeedKmh: body.speed_kmh ?? undefined,
      lastFuelPercent: fuel ?? undefined,
      lastOdometerKm: body.odometer_km ?? undefined,
      lastEngineRpm: body.rpm ?? undefined,
      lastCoolantC: body.coolant_c ?? undefined,
      lastBatteryV: body.battery_v ?? undefined,
      lastIgnition: body.ignition ?? undefined,
      lastDtcsJson: dtcsJson ?? undefined,
      lastExtrasJson: extrasJson ?? undefined,
      lastNetwork: networkType ?? undefined,
      lastRssi: rssi ?? undefined,
      ...(body.firmware ? { firmware: body.firmware } : {}),
    },
  });

  // Συγχρονισμός στο όχημα (θέση / καύσιμο / χλμ)
  if (device.vehicleId) {
    const fuelLabel =
      fuel != null
        ? fuel >= 87.5
          ? "Full"
          : fuel >= 62.5
            ? "3/4"
            : fuel >= 37.5
              ? "1/2"
              : fuel >= 12.5
                ? "1/4"
                : "Empty"
        : undefined;

    await prisma.vehicle.update({
      where: { id: device.vehicleId },
      data: {
        ...(lat != null && lng != null
          ? {
              lat,
              lng,
              locationLabel: "Tracker",
              locationUpdatedAt: recordedAt,
            }
          : {}),
        ...(body.odometer_km != null
          ? { odometerKm: Math.round(body.odometer_km) }
          : {}),
        ...(fuelLabel ? { fuelLevel: fuelLabel } : {}),
      },
    });
  }

  // Καθάρισμα παλιών readings (κρατάμε ~7 ημέρες ανά συσκευή — best effort)
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  void prisma.telematicsReading
    .deleteMany({
      where: { deviceId: device.id, recordedAt: { lt: cutoff } },
    })
    .catch(() => undefined);

  return { deviceId: device.id, readingId: reading.id, vehicleId: device.vehicleId };
}

export function isDeviceOnline(lastSeenAt?: Date | null, withinMs = 5 * 60 * 1000) {
  if (!lastSeenAt) return false;
  return Date.now() - lastSeenAt.getTime() <= withinMs;
}
