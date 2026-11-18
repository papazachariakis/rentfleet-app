import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { sortByCategoryName } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1),
  vehicleType: z.enum(["CAR", "MOTO", "SCOOTER", "VAN"]).default("CAR"),
  description: z.string().optional().nullable(),
  baseDailyRate: z.coerce.number().positive(),
  depositAmount: z.coerce.number().min(0).default(300),
  seats: z.coerce.number().int().optional().nullable(),
  transmission: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable().or(z.literal("")),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const categories = await prisma.vehicleCategory.findMany({
    where: { organizationId: session.organizationId },
  });
  return NextResponse.json({ categories: sortByCategoryName(categories) });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = schema.parse(await req.json());
    const name = body.name.trim();
    const existing = await prisma.vehicleCategory.findFirst({
      where: {
        organizationId: session.organizationId,
        name: { equals: name, mode: "insensitive" },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Η κατηγορία «${existing.name}» υπάρχει ήδη` },
        { status: 409 }
      );
    }
    const category = await prisma.vehicleCategory.create({
      data: {
        name,
        vehicleType: body.vehicleType,
        description: body.description || null,
        baseDailyRate: body.baseDailyRate,
        depositAmount: body.depositAmount,
        seats: body.seats || null,
        transmission: body.transmission || null,
        imageUrl: body.imageUrl?.trim() || null,
        organizationId: session.organizationId,
      },
    });
    return NextResponse.json({ ok: true, category });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "Η κατηγορία υπάρχει ήδη" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Μη έγκυρα στοιχεία" }, { status: 400 });
  }
}
