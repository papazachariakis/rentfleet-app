import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  organizationName: z.string().min(2),
  legalForm: z.enum(["NATURAL", "LEGAL"]).default("LEGAL"),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const email = body.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Υπάρχει ήδη λογαριασμός με αυτό το email." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const publicToken = crypto.randomUUID().replace(/-/g, "").slice(0, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: body.name,
        role: "OWNER",
        memberships: {
          create: {
            role: "ADMIN",
            organization: {
              create: {
                name: body.organizationName,
                legalForm: body.legalForm,
                publicToken,
                branches: {
                  create: {
                    name: "Κεντρικό",
                    code: "HQ",
                    city: "",
                  },
                },
              },
            },
          },
        },
      },
      include: { memberships: { include: { organization: true }, take: 1 } },
    });

    const membership = user.memberships[0];
    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: membership.role,
      organizationId: membership.organizationId,
      organizationName: membership.organization.name,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Μη έγκυρα στοιχεία." }, { status: 400 });
  }
}
