import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const schema = z.object({
  name: z.string().min(1),
  code: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  dailyRate: z.coerce.number().min(0).default(0),
  flatRate: z.coerce.number().min(0).optional().nullable(),
  active: z.boolean().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const extras = await prisma.extra.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ extras });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = schema.parse(await req.json());
    const extra = await prisma.extra.create({
      data: {
        name: body.name.trim(),
        code: body.code || null,
        description: body.description || null,
        dailyRate: body.dailyRate,
        flatRate: body.flatRate ?? null,
        active: body.active ?? true,
        organizationId: session.organizationId,
      },
    });
    return NextResponse.json({ ok: true, extra });
  } catch {
    return NextResponse.json({ error: "Μη έγκυρα στοιχεία" }, { status: 400 });
  }
}
