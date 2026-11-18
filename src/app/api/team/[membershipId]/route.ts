import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canManageTeam } from "@/lib/permissions";

const patchSchema = z.object({
  role: z.enum(["ADMIN", "DESK", "VIEWER"]).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ membershipId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageTeam(session)) {
    return NextResponse.json({ error: "Μόνο διαχειριστής" }, { status: 403 });
  }

  try {
    const { membershipId } = await ctx.params;
    const membership = await prisma.membership.findFirst({
      where: { id: membershipId, organizationId: session.organizationId },
    });
    if (!membership) {
      return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
    }

    const body = patchSchema.parse(await req.json());
    if (body.role) {
      // Μην υποβιβάσεις τον τελευταίο ADMIN
      if (membership.role === "ADMIN" && body.role !== "ADMIN") {
        const adminCount = await prisma.membership.count({
          where: {
            organizationId: session.organizationId,
            role: "ADMIN",
          },
        });
        if (adminCount <= 1) {
          return NextResponse.json(
            { error: "Πρέπει να μείνει τουλάχιστον ένας διαχειριστής" },
            { status: 400 }
          );
        }
      }
      await prisma.membership.update({
        where: { id: membershipId },
        data: { role: body.role },
      });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Αποτυχία" }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ membershipId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageTeam(session)) {
    return NextResponse.json({ error: "Μόνο διαχειριστής" }, { status: 403 });
  }

  const { membershipId } = await ctx.params;
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId: session.organizationId },
    include: { user: true },
  });
  if (!membership) {
    return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
  }
  if (membership.userId === session.id) {
    return NextResponse.json(
      { error: "Δεν μπορείς να αφαιρέσεις τον εαυτό σου" },
      { status: 400 }
    );
  }
  if (membership.role === "ADMIN") {
    const adminCount = await prisma.membership.count({
      where: { organizationId: session.organizationId, role: "ADMIN" },
    });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "Πρέπει να μείνει τουλάχιστον ένας διαχειριστής" },
        { status: 400 }
      );
    }
  }

  await prisma.membership.delete({ where: { id: membershipId } });
  return NextResponse.json({ ok: true });
}
