import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isPlatformAdmin } from "@/lib/platform-admin";

export async function GET() {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      memberships: {
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
      },
      _count: {
        select: {
          vehicles: true,
          bookings: true,
          customers: true,
        },
      },
    },
  });

  return NextResponse.json({
    tenants: orgs.map((o) => ({
      id: o.id,
      name: o.name,
      afm: o.afm,
      publicToken: o.publicToken,
      taxMode: o.taxMode,
      createdAt: o.createdAt,
      counts: o._count,
      members: o.memberships.map((m) => ({
        membershipId: m.id,
        role: m.role,
        userId: m.user.id,
        email: m.user.email,
        name: m.user.name,
        platformRole: m.user.role,
      })),
    })),
  });
}
