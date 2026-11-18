import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const schema = z.object({
  name: z.string().min(1),
  code: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  aadeBranchCode: z.coerce.number().int().min(0).default(0),
  active: z.boolean().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const branches = await prisma.branch.findMany({
    where: { organizationId: session.organizationId },
    include: { _count: { select: { vehicles: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ branches });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = schema.parse(await req.json());
    const branch = await prisma.branch.create({
      data: {
        name: body.name.trim(),
        code: body.code || null,
        address: body.address || null,
        city: body.city || null,
        phone: body.phone || null,
        aadeBranchCode: body.aadeBranchCode,
        active: body.active ?? true,
        organizationId: session.organizationId,
      },
    });
    return NextResponse.json({ ok: true, branch });
  } catch {
    return NextResponse.json({ error: "Μη έγκυρα στοιχεία" }, { status: 400 });
  }
}
