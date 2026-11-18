import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const schema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  afm: z.string().optional().nullable(),
  isForeign: z.boolean().optional(),
  licenseNumber: z.string().optional().nullable(),
  licenseCountry: z.string().optional().nullable(),
  idDocumentNo: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  blacklisted: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await ctx.params;
    const existing = await prisma.customer.findFirst({
      where: { id, organizationId: session.organizationId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
    }
    const body = schema.parse(await req.json());
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...(body.firstName ? { firstName: body.firstName.trim() } : {}),
        ...(body.lastName ? { lastName: body.lastName.trim() } : {}),
        ...(body.email !== undefined ? { email: body.email || null } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.afm !== undefined ? { afm: body.afm } : {}),
        ...(body.isForeign !== undefined ? { isForeign: body.isForeign } : {}),
        ...(body.licenseNumber !== undefined
          ? { licenseNumber: body.licenseNumber }
          : {}),
        ...(body.licenseCountry !== undefined
          ? { licenseCountry: body.licenseCountry }
          : {}),
        ...(body.idDocumentNo !== undefined
          ? { idDocumentNo: body.idDocumentNo }
          : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.blacklisted !== undefined
          ? { blacklisted: body.blacklisted }
          : {}),
      },
    });
    return NextResponse.json({ ok: true, customer });
  } catch {
    return NextResponse.json({ error: "Αποτυχία" }, { status: 400 });
  }
}
