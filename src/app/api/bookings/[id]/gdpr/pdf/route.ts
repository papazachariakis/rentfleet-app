import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { loadBookingDocPayload } from "@/lib/booking-documents";
import { buildGdprPdf } from "@/lib/gdpr-pdf";
import { buildGdprHtml } from "@/lib/gdpr-html";

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
    const html = buildGdprHtml(payload);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const pdf = await buildGdprPdf(payload);
  const filename = `gdpr-${payload.code || id}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
