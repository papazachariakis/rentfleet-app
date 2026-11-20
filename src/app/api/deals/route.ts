import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canManageSettings, canWriteOps } from "@/lib/permissions";
import { dealThresholdDays, normalizeDiscountType } from "@/lib/deals";

const schema = z.object({
  badge: z.string().max(40).optional().nullable(),
  title: z.string().min(1).max(160),
  body: z.string().max(2000).optional().nullable(),
  cta: z.string().max(60).optional().nullable(),
  priceLabel: z.string().max(80).optional().nullable(),
  discountType: z
    .enum(["OVERRIDE_DAILY", "PERCENT", "FREE_DAYS"])
    .default("FREE_DAYS"),
  dealValue: z.coerce.number().positive(),
  paidDays: z.coerce.number().int().positive().optional().nullable(),
  active: z.boolean().optional(),
  validFrom: z.string().optional().nullable(),
  validTo: z.string().optional().nullable(),
  minDays: z.coerce.number().int().positive().optional().nullable(),
  imageUrl: z.string().url().optional().or(z.literal("")).nullable(),
  categoryId: z.string().min(1).optional().nullable(),
  sortOrder: z.coerce.number().int().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [deals, categories] = await Promise.all([
    prisma.deal.findMany({
      where: { organizationId: session.organizationId },
      include: { category: { select: { id: true, name: true } } },
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    prisma.vehicleCategory.findMany({
      where: { organizationId: session.organizationId, active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        vehicleType: true,
        baseDailyRate: true,
      },
    }),
  ]);

  return NextResponse.json({ deals, categories });
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
    const discountType = normalizeDiscountType(body.discountType);

    if (body.categoryId) {
      const cat = await prisma.vehicleCategory.findFirst({
        where: {
          id: body.categoryId,
          organizationId: session.organizationId,
        },
        select: { id: true },
      });
      if (!cat) {
        return NextResponse.json(
          { error: "Άκυρη κατηγορία" },
          { status: 400 }
        );
      }
    }

    if (discountType === "FREE_DAYS" && !(body.paidDays && body.paidDays > 0)) {
      return NextResponse.json(
        { error: "Για 5+1 συμπλήρωσε τις πληρωτέες ημέρες (π.χ. 5)" },
        { status: 400 }
      );
    }

    const draft = {
      badge: body.badge?.trim() || "Προσφορά",
      title: body.title.trim(),
      body: body.body?.trim() || null,
      cta: body.cta?.trim() || "Κλείσε τώρα",
      priceLabel: body.priceLabel?.trim() || null,
      discountType,
      dealValue: body.dealValue,
      paidDays: discountType === "FREE_DAYS" ? body.paidDays ?? null : null,
      active: body.active ?? true,
      validFrom: body.validFrom ? new Date(body.validFrom) : null,
      validTo: body.validTo ? new Date(body.validTo) : null,
      minDays: body.minDays ?? null,
      imageUrl: body.imageUrl?.trim() || null,
      categoryId: body.categoryId || null,
      sortOrder: body.sortOrder ?? 0,
      organizationId: session.organizationId,
    };

    if (discountType === "FREE_DAYS" && draft.minDays == null) {
      draft.minDays = dealThresholdDays(draft);
    }

    const deal = await prisma.deal.create({
      data: draft,
      include: { category: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ ok: true, deal });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Μη έγκυρα στοιχεία" }, { status: 400 });
    }
    console.error("deals POST", e);
    return NextResponse.json({ error: "Αποτυχία" }, { status: 400 });
  }
}
