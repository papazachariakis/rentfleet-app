import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canManageSettings, canWriteOps } from "@/lib/permissions";
import { generateDeviceKey, isDeviceOnline } from "@/lib/telematics";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const devices = await prisma.telematicsDevice.findMany({
    where: { organizationId: session.organizationId },
    include: {
      vehicle: {
        select: {
          id: true,
          plateNumber: true,
          make: true,
          model: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    devices: devices.map((d) => ({
      ...d,
      deviceKeyHash: undefined,
      online: isDeviceOnline(d.lastSeenAt),
      lastDtcs: (() => {
        try {
          return JSON.parse(d.lastDtcsJson || "[]");
        } catch {
          return [];
        }
      })(),
    })),
  });
}

const createSchema = z.object({
  name: z.string().min(2).max(80),
  hardware: z
    .enum(["ESP32_OBD2", "ESP32_GPS", "OBD2_DONGLE", "OTHER"])
    .default("ESP32_OBD2"),
  connectivity: z.enum(["WIFI", "LTE", "NR", "MULTI"]).default("WIFI"),
  vehicleId: z.string().optional().nullable(),
  imei: z.string().max(32).optional().nullable(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageSettings(session) && !canWriteOps(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageSettings(session)) {
    return NextResponse.json({ error: "Μόνο διαχειριστής" }, { status: 403 });
  }

  try {
    const body = createSchema.parse(await req.json());
    if (body.vehicleId) {
      const v = await prisma.vehicle.findFirst({
        where: {
          id: body.vehicleId,
          organizationId: session.organizationId,
        },
      });
      if (!v) {
        return NextResponse.json({ error: "Όχημα δεν βρέθηκε" }, { status: 404 });
      }
      const taken = await prisma.telematicsDevice.findFirst({
        where: { vehicleId: body.vehicleId },
      });
      if (taken) {
        return NextResponse.json(
          { error: "Το όχημα έχει ήδη tracker" },
          { status: 409 }
        );
      }
    }

    const { key, hash, prefix } = generateDeviceKey();
    const device = await prisma.telematicsDevice.create({
      data: {
        name: body.name.trim(),
        hardware: body.hardware,
        connectivity: body.connectivity,
        deviceKeyHash: hash,
        deviceKeyPrefix: prefix,
        vehicleId: body.vehicleId || null,
        imei: body.imei || null,
        organizationId: session.organizationId,
      },
    });

    return NextResponse.json({
      ok: true,
      device: { ...device, deviceKeyHash: undefined },
      /** Εμφανίζεται ΜΟΝΟ μία φορά — αποθήκευσέ το στο ESP32 */
      deviceKey: key,
    });
  } catch {
    return NextResponse.json({ error: "Αποτυχία δημιουργίας" }, { status: 400 });
  }
}
