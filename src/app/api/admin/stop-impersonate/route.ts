import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, getSession } from "@/lib/session";
import { isPlatformAdmin } from "@/lib/platform-admin";

export async function POST() {
  const session = await getSession();
  if (!session || !session.impersonating || !isPlatformAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminId = session.realUserId;
  if (!adminId) {
    return NextResponse.json({ error: "Missing admin" }, { status: 400 });
  }

  const admin = await prisma.user.findUnique({
    where: { id: adminId },
    include: {
      memberships: { include: { organization: true }, take: 1 },
    },
  });
  if (!admin) {
    return NextResponse.json({ error: "Admin not found" }, { status: 404 });
  }

  const membership = admin.memberships[0];
  await createSession({
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: "PLATFORM_ADMIN",
    organizationId: membership?.organizationId || "",
    organizationName: membership?.organization.name || "RentFleet Platform",
    platformAdmin: true,
    impersonating: false,
  });

  return NextResponse.json({ ok: true, redirectTo: "/admin" });
}
