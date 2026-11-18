import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const schema = z.object({
  plateNumber: z.string().min(2).max(20),
  make: z.string().min(1).max(60),
  model: z.string().min(1).max(60),
  year: z.coerce.number().int().min(1980).max(2100).optional().nullable(),
  color: z.string().optional().nullable(),
  vehicleType: z.enum(["CAR", "MOTO", "SCOOTER", "VAN"]).default("CAR"),
  status: z
    .enum(["AVAILABLE", "RENTED", "MAINTENANCE", "BLOCKED", "OUT_OF_SERVICE"])
    .default("AVAILABLE"),
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
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const vehicles = await prisma.vehicle.findMany({
    where: { organizationId: session.organizationId },
    include: { category: true, branch: true },
    orderBy: { plateNumber: "asc" },
  });
  return NextResponse.json({ vehicles });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = schema.parse(await req.json());
    const vehicle = await prisma.vehicle.create({
      data: {
        plateNumber: body.plateNumber.toUpperCase().trim(),
        make: body.make.trim(),
        model: body.model.trim(),
        year: body.year || null,
        color: body.color || null,
        vehicleType: body.vehicleType,
        status: body.status,
        odometerKm: body.odometerKm || 0,
        fuelType: body.fuelType || null,
        categoryId: body.categoryId || null,
        branchId: body.branchId || null,
        insuranceExpiry: body.insuranceExpiry
          ? new Date(body.insuranceExpiry)
          : null,
        kteoExpiry: body.kteoExpiry ? new Date(body.kteoExpiry) : null,
        mechanicalExpiry: body.mechanicalExpiry
          ? new Date(body.mechanicalExpiry)
          : null,
        notes: body.notes || null,
        active: body.active ?? true,
        dailyRate: body.dailyRate ?? null,
        depositAmount: body.depositAmount ?? null,
        organizationId: session.organizationId,
      },
    });
    return NextResponse.json({ ok: true, vehicle });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Μη έγκυρα στοιχεία" }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Αποτυχία — μήπως η πινακίδα υπάρχει ήδη;" },
      { status: 400 }
    );
  }
}
