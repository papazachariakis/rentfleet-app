import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canManageSettings, canWriteOps } from "@/lib/permissions";
import { newPartnerToken } from "@/lib/partners";

const schema = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(["BROKER", "HOTEL", "OTHER"]).default("BROKER"),
  contactName: z.string().max(120).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  notes: z.string().max(2000).optional().nullable(),
  active: z.boolean().optional(),
  validFrom: z.string().optional().nullable(),
  validTo: z.string().optional().nullable(),
  discountPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  /** Αρχικές τιμές ανά categoryId */
  rates: z
    .array(
      z.object({
        categoryId: z.string().min(1),
        dailyRate: z.coerce.number().positive(),
        depositAmount: z.coerce.number().min(0).optional().nullable(),
      })
    )
    .optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [agreements, categories] = await Promise.all([
    prisma.partnerAgreement.findMany({
      where: { organizationId: session.organizationId },
      include: {
        rates: { include: { category: true } },
        _count: { select: { bookings: true } },
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.vehicleCategory.findMany({
      where: { organizationId: session.organizationId, active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({ agreements, categories });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canWriteOps(session) && !canManageSettings(session)) {
    return NextResponse.json({ error: "Δεν επιτρέπεται" }, { status: 403 });
  }

  try {
    const body = schema.parse(await req.json());
    const agreement = await prisma.partnerAgreement.create({
      data: {
        name: body.name.trim(),
        kind: body.kind,
        contactName: body.contactName?.trim() || null,
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        notes: body.notes?.trim() || null,
        active: body.active ?? true,
        validFrom: body.validFrom ? new Date(body.validFrom) : null,
        validTo: body.validTo ? new Date(body.validTo) : null,
        discountPercent: body.discountPercent ?? null,
        publicToken: newPartnerToken(),
        organizationId: session.organizationId,
        rates: body.rates?.length
          ? {
              create: body.rates.map((r) => ({
                categoryId: r.categoryId,
                dailyRate: r.dailyRate,
                depositAmount: r.depositAmount ?? null,
              })),
            }
          : undefined,
      },
      include: { rates: { include: { category: true } } },
    });
    return NextResponse.json({ ok: true, agreement });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Μη έγκυρα στοιχεία" }, { status: 400 });
    }
    console.error("partners POST", e);
    return NextResponse.json({ error: "Αποτυχία" }, { status: 400 });
  }
}
