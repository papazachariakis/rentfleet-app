import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { retryLedgerSubmission } from "@/lib/bookings";

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
    const result = await retryLedgerSubmission({
      bookingId: id,
      organizationId: session.organizationId,
    });
    return NextResponse.json({
      ok: true,
      kind: result.kind,
      ledger: result.ledger,
      booking: result.booking,
    });
  } catch (e) {
    const code = e instanceof Error ? e.message : "ERROR";
    const map: Record<string, { status: number; error: string }> = {
      NOT_FOUND: { status: 404, error: "Δεν βρέθηκε" },
      NO_VEHICLE: { status: 400, error: "Λείπει όχημα" },
      INVALID_STATUS: {
        status: 400,
        error: "Μόνο μετά από παραλαβή/επιστροφή",
      },
      NOT_RETRYABLE: {
        status: 400,
        error: "Η υποβολή ΑΑΔΕ δεν χρειάζεται επανάληψη",
      },
    };
    const mapped = map[code] || {
      status: 400,
      error: "Αποτυχία επανυποβολής",
    };
    return NextResponse.json(
      { error: mapped.error },
      { status: mapped.status }
    );
  }
}
