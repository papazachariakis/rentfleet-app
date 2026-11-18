import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const existing = await prisma.priceRule.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
  }

  await prisma.priceRule.update({
    where: { id },
    data: { active: false },
  });
  return NextResponse.json({ ok: true });
}
