import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getComplianceAlerts } from "@/lib/maintenance";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const vehicleId = url.searchParams.get("vehicleId");

  const [logs, alerts] = await Promise.all([
    prisma.maintenanceLog.findMany({
      where: {
        organizationId: session.organizationId,
        ...(vehicleId ? { vehicleId } : {}),
      },
      include: {
        vehicle: {
          select: { plateNumber: true, make: true, model: true },
        },
      },
      orderBy: { performedAt: "desc" },
      take: 50,
    }),
    getComplianceAlerts(session.organizationId, 45),
  ]);

  return NextResponse.json({ logs, alerts });
}

const schema = z.object({
  vehicleId: z.string().min(1),
  kind: z
    .enum(["SERVICE", "REPAIR", "KTEO", "INSURANCE", "OTHER"])
    .default("SERVICE"),
  title: z.string().min(2).max(120),
  notes: z.string().max(2000).optional().nullable(),
  cost: z.coerce.number().min(0).default(0),
  odometerKm: z.coerce.number().int().min(0).optional().nullable(),
  performedAt: z.string().optional(),
  nextDueAt: z.string().optional().nullable(),
  vendor: z.string().max(120).optional().nullable(),
  /** Αν true, ενημερώνει λήξη στο όχημα */
  syncVehicleExpiry: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = schema.parse(await req.json());
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: body.vehicleId,
        organizationId: session.organizationId,
      },
    });
    if (!vehicle) {
      return NextResponse.json({ error: "Όχημα δεν βρέθηκε" }, { status: 404 });
    }

    const performedAt = body.performedAt
      ? new Date(body.performedAt)
      : new Date();
    const nextDueAt = body.nextDueAt ? new Date(body.nextDueAt) : null;

    const log = await prisma.$transaction(async (tx) => {
      const created = await tx.maintenanceLog.create({
        data: {
          vehicleId: body.vehicleId,
          organizationId: session.organizationId,
          kind: body.kind,
          title: body.title.trim(),
          notes: body.notes || null,
          cost: body.cost,
          odometerKm: body.odometerKm ?? null,
          performedAt,
          nextDueAt,
          vendor: body.vendor || null,
        },
      });

      const vehiclePatch: Record<string, unknown> = {};
      if (body.odometerKm != null && body.odometerKm > vehicle.odometerKm) {
        vehiclePatch.odometerKm = body.odometerKm;
      }
      if (body.syncVehicleExpiry && nextDueAt) {
        if (body.kind === "INSURANCE") vehiclePatch.insuranceExpiry = nextDueAt;
        if (body.kind === "KTEO") vehiclePatch.kteoExpiry = nextDueAt;
        if (body.kind === "SERVICE") vehiclePatch.mechanicalExpiry = nextDueAt;
      }
      if (Object.keys(vehiclePatch).length) {
        await tx.vehicle.update({
          where: { id: vehicle.id },
          data: vehiclePatch,
        });
      }
      return created;
    });

    return NextResponse.json({ ok: true, log });
  } catch {
    return NextResponse.json({ error: "Αποτυχία καταχώρησης" }, { status: 400 });
  }
}
