import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { loadBookingDocPayload } from "@/lib/booking-documents";
import { buildAgreementPdf } from "@/lib/agreement-pdf";
import { buildAgreementHtml } from "@/lib/agreement-html";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const payload = await loadBookingDocPayload(id, session.organizationId);
  if (!payload) {
    return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
  }

  const url = new URL(req.url);
  if (url.searchParams.get("format") === "html") {
    const html = buildAgreementHtml(payload);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
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
