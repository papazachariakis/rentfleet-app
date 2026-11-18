import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canManageSettings } from "@/lib/permissions";
import { isValidHexColor } from "@/lib/branding";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: {
      name: true,
      publicToken: true,
      brandPrimary: true,
      brandAccent: true,
      brandLogoUrl: true,
      brandTagline: true,
      brandHeroText: true,
      hidePoweredBy: true,
    },
  });
  return NextResponse.json({ branding: org });
}

const schema = z.object({
  brandPrimary: z.string().optional().nullable(),
  brandAccent: z.string().optional().nullable(),
  brandLogoUrl: z.string().url().optional().nullable().or(z.literal("")),
  brandTagline: z.string().max(120).optional().nullable(),
  brandHeroText: z.string().max(200).optional().nullable(),
  hidePoweredBy: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageSettings(session)) {
    return NextResponse.json({ error: "Μόνο διαχειριστής" }, { status: 403 });
  }

  try {
    const body = schema.parse(await req.json());
    if (!isValidHexColor(body.brandPrimary) || !isValidHexColor(body.brandAccent)) {
      return NextResponse.json(
        { error: "Χρώμα σε μορφή #RRGGBB" },
        { status: 400 }
      );
    }

    await prisma.organization.update({
      where: { id: session.organizationId },
      data: {
        brandPrimary: body.brandPrimary || null,
        brandAccent: body.brandAccent || null,
        brandLogoUrl: body.brandLogoUrl || null,
        brandTagline: body.brandTagline || null,
        brandHeroText: body.brandHeroText || null,
        hidePoweredBy: body.hidePoweredBy ?? false,
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Μη έγκυρα στοιχεία" }, { status: 400 });
  }
}
