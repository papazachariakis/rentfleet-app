import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, getSession } from "@/lib/session";
import { isPlatformAdmin } from "@/lib/platform-admin";

const schema = z.object({
  userId: z.string().min(1),
  organizationId: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Αν ήδη impersonates, χρησιμοποίησε τον πραγματικό admin ως βάση
  const adminUserId = session.realUserId || session.id;
  const adminEmail = session.realEmail || session.email;
  const adminName = session.realName || session.name;
  const adminRole = session.realRole || session.role;
  const adminOrgId = session.realOrganizationId ?? session.organizationId;
  const adminOrgName =
    session.realOrganizationName ?? session.organizationName;

  try {
    const body = schema.parse(await req.json());

    const membership = await prisma.membership.findFirst({
      where: {
        userId: body.userId,
        ...(body.organizationId
          ? { organizationId: body.organizationId }
          : {}),
      },
      include: {
        user: true,
        organization: true,
      },
      orderBy: { id: "asc" },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Ο χρήστης δεν ανήκει σε οργανισμό" },
        { status: 404 }
      );
    }

    await createSession({
      id: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      role: membership.role,
      organizationId: membership.organizationId,
      organizationName: membership.organization.name,
      platformAdmin: true,
      impersonating: true,
      realUserId: adminUserId,
      realEmail: adminEmail,
      realName: adminName,
      realRole: adminRole,
      realOrganizationId: adminOrgId,
      realOrganizationName: adminOrgName,
    });

    return NextResponse.json({
      ok: true,
      redirectTo: "/dashboard",
      as: {
        email: membership.user.email,
        org: membership.organization.name,
      },
    });
  } catch {
    return NextResponse.json({ error: "Αποτυχία" }, { status: 400 });
  }
}
