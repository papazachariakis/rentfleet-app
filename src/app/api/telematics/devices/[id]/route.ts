import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canManageSettings } from "@/lib/permissions";
import { generateDeviceKey, isDeviceOnline } from "@/lib/telematics";

async function owned(id: string, orgId: string) {
  return prisma.telematicsDevice.findFirst({
    where: { id, organizationId: orgId },
  });
}

const patchSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  hardware: z
    .enum(["ESP32_OBD2", "ESP32_GPS", "OBD2_DONGLE", "OTHER"])
    .optional(),
  connectivity: z.enum(["WIFI", "LTE", "NR", "MULTI"]).optional(),
  vehicleId: z.string().nullable().optional(),
  imei: z.string().max(32).nullable().optional(),
  active: z.boolean().optional(),
  rotateKey: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const device = await prisma.telematicsDevice.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      vehicle: true,
      readings: { orderBy: { recordedAt: "desc" }, take: 40 },
    },
  });
  if (!device) {
    return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
  }
  return NextResponse.json({
    device: {
      ...device,
      deviceKeyHash: undefined,
      online: isDeviceOnline(device.lastSeenAt),
    },
  });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageSettings(session)) {
    return NextResponse.json({ error: "Μόνο διαχειριστής" }, { status: 403 });
  }

  try {
    const { id } = await ctx.params;
    const existing = await owned(id, session.organizationId);
    if (!existing) {
      return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
    }
    const body = patchSchema.parse(await req.json());

    if (body.vehicleId) {
      const taken = await prisma.telematicsDevice.findFirst({
        where: {
          vehicleId: body.vehicleId,
          id: { not: id },
        },
      });
      if (taken) {
        return NextResponse.json(
          { error: "Το όχημα έχει ήδη tracker" },
          { status: 409 }
        );
      }
    }

    let rotatedKey: string | undefined;
    const keyUpdate = body.rotateKey
      ? (() => {
          const g = generateDeviceKey();
          rotatedKey = g.key;
          return {
            deviceKeyHash: g.hash,
            deviceKeyPrefix: g.prefix,
          };
        })()
      : {};

    const device = await prisma.telematicsDevice.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name.trim() } : {}),
        ...(body.hardware ? { hardware: body.hardware } : {}),
        ...(body.connectivity ? { connectivity: body.connectivity } : {}),
        ...(body.vehicleId !== undefined ? { vehicleId: body.vehicleId } : {}),
        ...(body.imei !== undefined ? { imei: body.imei } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...keyUpdate,
      },
    });

    return NextResponse.json({
      ok: true,
      device: { ...device, deviceKeyHash: undefined },
      ...(rotatedKey ? { deviceKey: rotatedKey } : {}),
    });
  } catch {
    return NextResponse.json({ error: "Αποτυχία" }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageSettings(session)) {
    return NextResponse.json({ error: "Μόνο διαχειριστής" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const existing = await owned(id, session.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
  }
  await prisma.telematicsDevice.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
