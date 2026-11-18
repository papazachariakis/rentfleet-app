import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const booking = await prisma.booking.findFirst({
    where: { id, organizationId: session.organizationId },
    select: {
      id: true,
      code: true,
      status: true,
      licenseScanPdf: true,
      licenseScanCreatedAt: true,
    },
  });
  if (!booking) {
    return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
  }
  if (!booking.licenseScanPdf) {
    return NextResponse.json(
      { error: "Δεν υπάρχει αποθηκευμένη σάρωση άδειας" },
      { status: 404 }
    );
  }

  const filename = `adeia-${booking.code || booking.id}.pdf`;
  return new NextResponse(new Uint8Array(booking.licenseScanPdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
