import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { isPlatformAdminEmail } from "@/lib/platform-admin";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const email = body.email.toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: { include: { organization: true }, take: 1 },
      },
    });

    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return NextResponse.json(
        { error: "Λάθος email ή κωδικός." },
        { status: 401 }
      );
    }

    const platformAdmin =
      isPlatformAdminEmail(user.email) || user.role === "PLATFORM_ADMIN";

    if (platformAdmin && user.role !== "PLATFORM_ADMIN") {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: "PLATFORM_ADMIN" },
      });
    }

    const membership = user.memberships[0];

    // Platform admin χωρίς org: μπαίνει στο /admin
    if (!membership && platformAdmin) {
      await createSession({
        id: user.id,
        email: user.email,
        name: user.name,
        role: "PLATFORM_ADMIN",
        organizationId: "",
        organizationName: "RentFleet Platform",
        platformAdmin: true,
        impersonating: false,
      });
      return NextResponse.json({ ok: true, redirectTo: "/admin" });
    }

    if (!membership) {
      return NextResponse.json(
        { error: "Δεν βρέθηκε οργανισμός για τον χρήστη." },
        { status: 400 }
      );
    }

    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: platformAdmin ? "PLATFORM_ADMIN" : membership.role,
      organizationId: membership.organizationId,
      organizationName: membership.organization.name,
      platformAdmin,
      impersonating: false,
    });

    return NextResponse.json({
      ok: true,
      redirectTo: platformAdmin ? "/admin" : "/dashboard",
    });
  } catch {
    return NextResponse.json({ error: "Μη έγκυρα στοιχεία." }, { status: 400 });
  }
}
