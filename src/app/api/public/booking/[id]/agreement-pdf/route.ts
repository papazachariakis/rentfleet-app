import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadBookingDocPayload } from "@/lib/booking-documents";
import { buildAgreementPdf } from "@/lib/agreement-pdf";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const allowed = await prisma.booking.findFirst({
    where: {
      id,
      organization: { publicToken: token },
    },
    select: { id: true },
  });
  if (!allowed) {
    return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
  }

  const payload = await loadBookingDocPayload(id);
  if (!payload) {
    return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
  }

  try {
    const pdf = await buildAgreementPdf(payload);
    const filename = `misthotirio-${payload.code || id}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("agreement-pdf", e);
    return NextResponse.json(
      { error: "Αποτυχία δημιουργίας PDF" },
      { status: 500 }
    );
  }
}
