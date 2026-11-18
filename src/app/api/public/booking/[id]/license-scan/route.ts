import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const booking = await prisma.booking.findFirst({
    where: {
      id,
      organization: { publicToken: token },
    },
    select: {
      id: true,
      code: true,
      licenseScanPdf: true,
    },
  });
  if (!booking?.licenseScanPdf) {
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
