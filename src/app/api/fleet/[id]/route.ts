import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { BLOCKING_STATUSES } from "@/lib/bookings";

const schema = z.object({
  plateNumber: z.string().min(2).max(20).optional(),
  make: z.string().min(1).max(60).optional(),
  model: z.string().min(1).max(60).optional(),
  year: z.coerce.number().int().min(1980).max(2100).optional().nullable(),
  color: z.string().optional().nullable(),
  vehicleType: z.enum(["CAR", "MOTO", "SCOOTER", "VAN"]).optional(),
  status: z
    .enum(["AVAILABLE", "RENTED", "MAINTENANCE", "BLOCKED", "OUT_OF_SERVICE"])
    .optional(),
  odometerKm: z.coerce.number().int().min(0).optional(),
  fuelType: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
  insuranceExpiry: z.string().optional().nullable(),
  kteoExpiry: z.string().optional().nullable(),
  mechanicalExpiry: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  active: z.boolean().optional(),
  dailyRate: z.coerce.number().positive().optional().nullable(),
  depositAmount: z.coerce.number().min(0).optional().nullable(),
  lat: z.coerce.number().min(-90).max(90).optional().nullable(),
  lng: z.coerce.number().min(-180).max(180).optional().nullable(),
  locationLabel: z.string().max(200).optional().nullable(),
});

async function owned(id: string, orgId: string) {
  return prisma.vehicle.findFirst({
    where: { id, organizationId: orgId },
  });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await ctx.params;
    const existing = await owned(id, session.organizationId);
    if (!existing) {
      return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
    }

    const body = schema.parse(await req.json());
    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        ...(body.plateNumber
          ? { plateNumber: body.plateNumber.toUpperCase().trim() }
          : {}),
        ...(body.make ? { make: body.make.trim() } : {}),
        ...(body.model ? { model: body.model.trim() } : {}),
        ...(body.year !== undefined ? { year: body.year } : {}),
        ...(body.color !== undefined ? { color: body.color } : {}),
        ...(body.vehicleType ? { vehicleType: body.vehicleType } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.odometerKm !== undefined
          ? { odometerKm: body.odometerKm }
          : {}),
        ...(body.fuelType !== undefined ? { fuelType: body.fuelType } : {}),
        ...(body.categoryId !== undefined
          ? { categoryId: body.categoryId }
          : {}),
        ...(body.branchId !== undefined ? { branchId: body.branchId } : {}),
        ...(body.insuranceExpiry !== undefined
          ? {
              insuranceExpiry: body.insuranceExpiry
                ? new Date(body.insuranceExpiry)
                : null,
            }
          : {}),
        ...(body.kteoExpiry !== undefined
          ? {
              kteoExpiry: body.kteoExpiry ? new Date(body.kteoExpiry) : null,
            }
          : {}),
        ...(body.mechanicalExpiry !== undefined
          ? {
              mechanicalExpiry: body.mechanicalExpiry
                ? new Date(body.mechanicalExpiry)
                : null,
            }
          : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.dailyRate !== undefined ? { dailyRate: body.dailyRate } : {}),
        ...(body.depositAmount !== undefined
          ? { depositAmount: body.depositAmount }
          : {}),
        ...(body.lat !== undefined || body.lng !== undefined
          ? {
              lat: body.lat ?? null,
              lng: body.lng ?? null,
              locationUpdatedAt:
                body.lat != null && body.lng != null ? new Date() : null,
            }
          : {}),
        ...(body.locationLabel !== undefined
          ? { locationLabel: body.locationLabel }
          : {}),
      },
    });
    return NextResponse.json({ ok: true, vehicle });
  } catch {
    return NextResponse.json({ error: "Αποτυχία ενημέρωσης" }, { status: 400 });
  }
}

/** soft=1 → απενεργοποίηση · αλλιώς οριστική διαγραφή (αν δεν υπάρχουν ενεργές κρατήσεις). */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const existing = await owned(id, session.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
  }

  const soft = new URL(req.url).searchParams.get("soft") === "1";
  if (soft) {
    await prisma.vehicle.update({
      where: { id },
      data: { active: false, status: "OUT_OF_SERVICE" },
    });
    return NextResponse.json({ ok: true, soft: true });
  }

  const activeBookings = await prisma.booking.count({
    where: {
      vehicleId: id,
      status: { in: [...BLOCKING_STATUSES] },
    },
  });
  if (activeBookings > 0) {
    return NextResponse.json(
      {
        error:
          "Το όχημα έχει ενεργές κρατήσεις. Ακύρωσέ τες ή απενεργοποίησε το όχημα.",
      },
      { status: 409 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.booking.updateMany({
      where: { vehicleId: id },
      data: { vehicleId: null },
    });
    await tx.telematicsDevice.deleteMany({ where: { vehicleId: id } });
    await tx.vehicle.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true, deleted: true });
}
