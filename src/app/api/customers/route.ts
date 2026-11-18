import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().nullable(),
  afm: z.string().optional().nullable(),
  isForeign: z.boolean().optional(),
  licenseNumber: z.string().optional().nullable(),
  licenseCountry: z.string().optional().nullable(),
  idDocumentNo: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  blacklisted: z.boolean().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const customers = await prisma.customer.findMany({
    where: { organizationId: session.organizationId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return NextResponse.json({ customers });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = schema.parse(await req.json());
    const customer = await prisma.customer.create({
      data: {
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        email: body.email || null,
        phone: body.phone || null,
        afm: body.afm || null,
        isForeign: body.isForeign ?? false,
        licenseNumber: body.licenseNumber || null,
        licenseCountry: body.licenseCountry || "GR",
        idDocumentNo: body.idDocumentNo || null,
        notes: body.notes || null,
        blacklisted: body.blacklisted ?? false,
        organizationId: session.organizationId,
      },
    });
    return NextResponse.json({ ok: true, customer });
  } catch {
    return NextResponse.json({ error: "Μη έγκυρα στοιχεία" }, { status: 400 });
  }
}
