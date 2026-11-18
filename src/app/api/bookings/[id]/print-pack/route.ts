import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { loadBookingDocPayload } from "@/lib/booking-documents";
import { buildPrintPackHtml } from "@/lib/print-pack-html";
import { ensureAgreement } from "@/lib/bookings";

/** Ενιαίο εκτυπώσιμο πακέτο: σύμβαση + GDPR για υπογραφή. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  await ensureAgreement(id);
  const payload = await loadBookingDocPayload(id, session.organizationId);
  if (!payload) {
    return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
  }

  const html = buildPrintPackHtml(payload);
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
