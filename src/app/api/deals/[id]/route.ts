import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canManageSettings, canWriteOps } from "@/lib/permissions";
import { dealThresholdDays, normalizeDiscountType } from "@/lib/deals";

const schema = z.object({
  badge: z.string().max(40).optional().nullable(),
  title: z.string().min(1).max(160).optional(),
  body: z.string().max(2000).optional().nullable(),
  cta: z.string().max(60).optional().nullable(),
  priceLabel: z.string().max(80).optional().nullable(),
  discountType: z.enum(["OVERRIDE_DAILY", "PERCENT", "FREE_DAYS"]).optional(),
  dealValue: z.coerce.number().positive().optional(),
  paidDays: z.coerce.number().int().positive().optional().nullable(),
  active: z.boolean().optional(),
  validFrom: z.string().optional().nullable(),
  validTo: z.string().optional().nullable(),
  minDays: z.coerce.number().int().positive().optional().nullable(),
  imageUrl: z.string().url().optional().or(z.literal("")).nullable(),
  categoryId: z.string().min(1).optional().nullable(),
  sortOrder: z.coerce.number().int().optional(),
});

async function owned(id: string, orgId: string) {
  return prisma.deal.findFirst({
    where: { id, organizationId: orgId },
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
  if (!canWriteOps(session) && !canManageSettings(session)) {
    return NextResponse.json({ error: "Δεν επιτρέπεται" }, { status: 403 });
  }

  try {
    const { id } = await ctx.params;
    const existing = await owned(id, session.organizationId);
    if (!existing) {
      return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
    }

    const body = schema.parse(await req.json());
    const discountType = normalizeDiscountType(
      body.discountType ?? existing.discountType
    );

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

    const paidDays =
      discountType === "FREE_DAYS"
        ? body.paidDays !== undefined
          ? body.paidDays
          : existing.paidDays
        : null;
    const dealValue = body.dealValue ?? existing.dealValue;

    if (discountType === "FREE_DAYS" && !(paidDays && paidDays > 0)) {
      return NextResponse.json(
        { error: "Για 5+1 συμπλήρωσε τις πληρωτέες ημέρες (π.χ. 5)" },
        { status: 400 }
      );
    }

    const data = {
      badge:
        body.badge !== undefined
          ? body.badge?.trim() || "Προσφορά"
          : undefined,
      title: body.title?.trim(),
      body:
        body.body !== undefined ? body.body?.trim() || null : undefined,
      cta:
        body.cta !== undefined
          ? body.cta?.trim() || "Κλείσε τώρα"
          : undefined,
      priceLabel:
        body.priceLabel !== undefined
          ? body.priceLabel?.trim() || null
          : undefined,
      discountType,
      dealValue,
      paidDays,
      active: body.active,
      validFrom:
        body.validFrom !== undefined
          ? body.validFrom
            ? new Date(body.validFrom)
            : null
          : undefined,
      validTo:
        body.validTo !== undefined
          ? body.validTo
            ? new Date(body.validTo)
            : null
          : undefined,
      minDays:
        body.minDays !== undefined ? body.minDays : undefined,
      imageUrl:
        body.imageUrl !== undefined
          ? body.imageUrl?.trim() || null
          : undefined,
      categoryId:
        body.categoryId !== undefined ? body.categoryId || null : undefined,
      sortOrder: body.sortOrder,
    };

    if (
      discountType === "FREE_DAYS" &&
      (body.minDays === undefined || body.minDays == null) &&
      (body.paidDays !== undefined || body.dealValue !== undefined)
    ) {
      data.minDays = dealThresholdDays({
        ...existing,
        discountType,
        dealValue,
        paidDays,
        minDays: null,
      });
    }

    const deal = await prisma.deal.update({
      where: { id },
      data,
      include: { category: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ ok: true, deal });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Μη έγκυρα στοιχεία" }, { status: 400 });
    }
    console.error("deals PATCH", e);
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
  if (!canWriteOps(session) && !canManageSettings(session)) {
    return NextResponse.json({ error: "Δεν επιτρέπεται" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const existing = await owned(id, session.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
  }

  await prisma.deal.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
