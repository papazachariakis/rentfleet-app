import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canManageTeam, ROLE_LABELS } from "@/lib/permissions";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const members = await prisma.membership.findMany({
    where: { organizationId: session.organizationId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      },
    },
    orderBy: { user: { createdAt: "asc" } },
  });

  return NextResponse.json({
    canManage: canManageTeam(session),
    roles: ROLE_LABELS,
    members: members.map((m) => ({
      membershipId: m.id,
      role: m.role,
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      platformRole: m.user.role,
      createdAt: m.user.createdAt,
      isYou: m.user.id === session.id,
    })),
  });
}

const createSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  role: z.enum(["ADMIN", "DESK", "VIEWER"]).default("DESK"),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageTeam(session)) {
    return NextResponse.json({ error: "Μόνο διαχειριστής" }, { status: 403 });
  }

  try {
    const body = createSchema.parse(await req.json());
    const email = body.email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      const already = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: existing.id,
            organizationId: session.organizationId,
          },
        },
      });
      if (already) {
        return NextResponse.json(
          { error: "Ο χρήστης είναι ήδη στην ομάδα" },
          { status: 409 }
        );
      }
      const membership = await prisma.membership.create({
        data: {
          userId: existing.id,
          organizationId: session.organizationId,
          role: body.role,
        },
      });
      return NextResponse.json({
        ok: true,
        linked: true,
        membershipId: membership.id,
      });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        name: body.name.trim(),
        passwordHash,
        role: body.role === "ADMIN" ? "ADMIN" : "STAFF",
        memberships: {
          create: {
            organizationId: session.organizationId,
            role: body.role,
          },
        },
      },
    });

    return NextResponse.json({ ok: true, userId: user.id });
  } catch {
    return NextResponse.json({ error: "Μη έγκυρα στοιχεία" }, { status: 400 });
  }
}
