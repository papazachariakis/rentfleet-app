import { NextResponse } from "next/server";
import { z } from "zod";
import { ingestTelemetry } from "@/lib/telematics";

export const runtime = "nodejs";

const schema = z.object({
  ts: z.string().optional(),
  gps: z
    .object({
      lat: z.number().optional(),
      lng: z.number().optional(),
      alt: z.number().optional(),
      hdop: z.number().optional(),
      satellites: z.number().optional(),
    })
    .optional(),
  speed_kmh: z.number().optional(),
  fuel_percent: z.number().optional(),
  fuel_level: z.number().optional(),
  odometer_km: z.number().optional(),
  rpm: z.number().optional(),
  coolant_c: z.number().optional(),
  battery_v: z.number().optional(),
  ignition: z.boolean().optional(),
  dtcs: z.array(z.string()).optional(),
  pids: z.record(z.string(), z.unknown()).optional(),
  extras: z.record(z.string(), z.unknown()).optional(),
  network: z
    .object({
      type: z.string().optional(),
      rssi: z.number().optional(),
    })
    .optional(),
  firmware: z.string().optional(),
});

/**
 * ESP32 / OBD2 ingest.
 * Auth: header `X-Device-Key: rf_tel_…`
 * ή Authorization: Bearer rf_tel_…
 */
export async function POST(req: Request) {
  const key =
    req.headers.get("x-device-key") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";

  if (!key.startsWith("rf_tel_")) {
    return NextResponse.json({ error: "Missing device key" }, { status: 401 });
  }

  try {
    const json = await req.json();
    const body = schema.parse(json);
    const result = await ingestTelemetry(key, body);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg === "UNAUTHORIZED_DEVICE") {
      return NextResponse.json({ error: "Invalid device key" }, { status: 401 });
    }
    console.error("telematics ingest", e);
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }
}

/** Health — χωρίς λεπτομέρειες πρωτοκόλλου */
export async function GET() {
  return NextResponse.json({ ok: true });
}
