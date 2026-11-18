import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { retryInvoice } from "@/lib/invoices";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await ctx.params;
    const result = await retryInvoice(id, session.organizationId);
    return NextResponse.json({
      ok: true,
      skipped: result.skipped,
      invoice: result.invoice,
      mydata: "result" in result ? result.result : undefined,
    });
  } catch (e) {
    const code = e instanceof Error ? e.message : "ERROR";
    if (code === "NOT_FOUND") {
      return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
    }
    if (code === "NOT_RETRYABLE") {
      return NextResponse.json(
        { error: "Το παραστατικό δεν χρειάζεται επανυποβολή" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Αποτυχία επανυποβολής" }, { status: 400 });
  }
}
