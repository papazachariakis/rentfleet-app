import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canManageSettings, canWriteOps } from "@/lib/permissions";
import { newPartnerToken } from "@/lib/partners";

const schema = z.object({
  name: z.string().min(1).max(120).optional(),
  kind: z.enum(["BROKER", "HOTEL", "OTHER"]).optional(),
  contactName: z.string().max(120).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  notes: z.string().max(2000).optional().nullable(),
  active: z.boolean().optional(),
  validFrom: z.string().optional().nullable(),
  validTo: z.string().optional().nullable(),
  discountPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  rotateToken: z.boolean().optional(),
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

async function owned(id: string, orgId: string) {
  return prisma.partnerAgreement.findFirst({
    where: { id, organizationId: orgId },
  });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const agreement = await prisma.partnerAgreement.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      rates: { include: { category: true } },
      _count: { select: { bookings: true } },
    },
  });
  if (!agreement) {
    return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
  }
  return NextResponse.json({ agreement });
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

    if (body.rates) {
      await prisma.$transaction(async (tx) => {
        await tx.partnerRate.deleteMany({ where: { agreementId: id } });
        if (body.rates!.length) {
          await tx.partnerRate.createMany({
            data: body.rates!.map((r) => ({
              agreementId: id,
              categoryId: r.categoryId,
              dailyRate: r.dailyRate,
              depositAmount: r.depositAmount ?? null,
            })),
          });
        }
      });
    }

    const agreement = await prisma.partnerAgreement.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name.trim() } : {}),
        ...(body.kind ? { kind: body.kind } : {}),
        ...(body.contactName !== undefined
          ? { contactName: body.contactName?.trim() || null }
          : {}),
        ...(body.phone !== undefined
          ? { phone: body.phone?.trim() || null }
          : {}),
        ...(body.email !== undefined
          ? { email: body.email?.trim() || null }
          : {}),
        ...(body.notes !== undefined
          ? { notes: body.notes?.trim() || null }
          : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.validFrom !== undefined
          ? { validFrom: body.validFrom ? new Date(body.validFrom) : null }
          : {}),
        ...(body.validTo !== undefined
          ? { validTo: body.validTo ? new Date(body.validTo) : null }
          : {}),
        ...(body.discountPercent !== undefined
          ? { discountPercent: body.discountPercent }
          : {}),
        ...(body.rotateToken ? { publicToken: newPartnerToken() } : {}),
      },
      include: { rates: { include: { category: true } } },
    });

    return NextResponse.json({ ok: true, agreement });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Μη έγκυρα στοιχεία" }, { status: 400 });
    }
    console.error("partners PATCH", e);
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
  if (!canManageSettings(session) && !canWriteOps(session)) {
    return NextResponse.json({ error: "Δεν επιτρέπεται" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const existing = await owned(id, session.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
  }

  const bookings = await prisma.booking.count({
    where: { partnerAgreementId: id },
  });
  if (bookings > 0) {
    await prisma.partnerAgreement.update({
      where: { id },
      data: { active: false },
    });
    return NextResponse.json({
      ok: true,
      soft: true,
      message: "Έχει κρατήσεις — απενεργοποιήθηκε",
    });
  }

  await prisma.partnerAgreement.delete({ where: { id } });
  return NextResponse.json({ ok: true, deleted: true });
}
