import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canManageSettings, canWriteOps } from "@/lib/permissions";

async function getOwned(id: string, organizationId: string) {
  return prisma.vehicleCategory.findFirst({
    where: { id, organizationId },
  });
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  vehicleType: z.enum(["CAR", "MOTO", "SCOOTER", "VAN"]).optional(),
  description: z.string().optional().nullable(),
  baseDailyRate: z.coerce.number().positive().optional(),
  depositAmount: z.coerce.number().min(0).optional(),
  seats: z.coerce.number().int().optional().nullable(),
  bags: z.coerce.number().int().optional().nullable(),
  doors: z.coerce.number().int().optional().nullable(),
  transmission: z.string().optional().nullable(),
  airConditioning: z.boolean().optional(),
  hasGps: z.boolean().optional(),
  imageUrl: z.string().url().optional().nullable().or(z.literal("")),
  active: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageSettings(session) && !canWriteOps(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const cat = await getOwned(id, session.organizationId);
    if (!cat) {
      return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
    }

    const body = patchSchema.parse(await req.json());
    if (body.name?.trim()) {
      const name = body.name.trim();
      const clash = await prisma.vehicleCategory.findFirst({
        where: {
          organizationId: session.organizationId,
          id: { not: id },
          name: { equals: name, mode: "insensitive" },
        },
      });
      if (clash) {
        return NextResponse.json(
          { error: `Η κατηγορία «${clash.name}» υπάρχει ήδη` },
          { status: 409 }
        );
      }
    }

    const category = await prisma.vehicleCategory.update({
      where: { id },
      data: {
        ...(body.name?.trim() ? { name: body.name.trim() } : {}),
        ...(body.vehicleType ? { vehicleType: body.vehicleType } : {}),
        ...(body.description !== undefined
          ? { description: body.description || null }
          : {}),
        ...(body.baseDailyRate !== undefined
          ? { baseDailyRate: body.baseDailyRate }
          : {}),
        ...(body.depositAmount !== undefined
          ? { depositAmount: body.depositAmount }
          : {}),
        ...(body.seats !== undefined ? { seats: body.seats } : {}),
        ...(body.bags !== undefined ? { bags: body.bags } : {}),
        ...(body.doors !== undefined ? { doors: body.doors } : {}),
        ...(body.transmission !== undefined
          ? { transmission: body.transmission || null }
          : {}),
        ...(body.airConditioning !== undefined
          ? { airConditioning: body.airConditioning }
          : {}),
        ...(body.hasGps !== undefined ? { hasGps: body.hasGps } : {}),
        ...(body.imageUrl !== undefined
          ? { imageUrl: body.imageUrl?.trim() || null }
          : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
      },
    });
    return NextResponse.json({ ok: true, category });
  } catch {
    return NextResponse.json({ error: "Αποτυχία ενημέρωσης" }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageSettings(session) && !canWriteOps(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const cat = await getOwned(id, session.organizationId);
  if (!cat) {
    return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
  }

  const inUse = await prisma.vehicle.count({
    where: { categoryId: id, organizationId: session.organizationId },
  });
  if (inUse > 0) {
    return NextResponse.json(
      { error: `Χρησιμοποιείται από ${inUse} οχήματα` },
      { status: 409 }
    );
  }

  await prisma.vehicleCategory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
