import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canManageSettings } from "@/lib/permissions";
import { sortByCategoryName } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  multiplier: z.coerce.number().min(0.1).max(10).default(1.2),
  minDailyRate: z.coerce.number().min(0).optional().nullable(),
  weekendOnly: z.boolean().optional(),
  categoryId: z.string().optional().nullable(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [rules, extras, categories] = await Promise.all([
    prisma.priceRule.findMany({
      where: { organizationId: session.organizationId },
      include: { category: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.extra.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { name: "asc" },
    }),
    prisma.vehicleCategory.findMany({
      where: { organizationId: session.organizationId, active: true },
    }),
  ]);

  return NextResponse.json({
    rules,
    extras,
    categories: sortByCategoryName(categories),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageSettings(session)) {
    return NextResponse.json({ error: "Μόνο διαχειριστής" }, { status: 403 });
  }

  try {
    const body = schema.parse(await req.json());
    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);
    if (!(startDate <= endDate)) {
      return NextResponse.json({ error: "Μη έγκυρες ημερομηνίες" }, { status: 400 });
    }
    const rule = await prisma.priceRule.create({
      data: {
        name: body.name.trim(),
        startDate,
        endDate,
        multiplier: body.multiplier,
        minDailyRate: body.minDailyRate ?? null,
        weekendOnly: body.weekendOnly ?? false,
        categoryId: body.categoryId || null,
        organizationId: session.organizationId,
      },
    });
    return NextResponse.json({ ok: true, rule });
  } catch {
    return NextResponse.json({ error: "Μη έγκυρα στοιχεία" }, { status: 400 });
  }
}
