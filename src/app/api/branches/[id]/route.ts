import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const schema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  aadeBranchCode: z.coerce.number().int().min(0).optional(),
  active: z.boolean().optional(),
  lat: z.coerce.number().min(-90).max(90).optional().nullable(),
  lng: z.coerce.number().min(-180).max(180).optional().nullable(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await ctx.params;
    const existing = await prisma.branch.findFirst({
      where: { id, organizationId: session.organizationId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
    }
    const body = schema.parse(await req.json());
    const branch = await prisma.branch.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name.trim() } : {}),
        ...(body.code !== undefined ? { code: body.code } : {}),
        ...(body.address !== undefined ? { address: body.address } : {}),
        ...(body.city !== undefined ? { city: body.city } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.aadeBranchCode !== undefined
          ? { aadeBranchCode: body.aadeBranchCode }
          : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.lat !== undefined ? { lat: body.lat } : {}),
        ...(body.lng !== undefined ? { lng: body.lng } : {}),
      },
    });
    return NextResponse.json({ ok: true, branch });
  } catch {
    return NextResponse.json({ error: "Αποτυχία" }, { status: 400 });
  }
}
