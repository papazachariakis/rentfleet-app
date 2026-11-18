import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { checkoutBooking } from "@/lib/bookings";

const schema = z.object({
  odometerKm: z.coerce.number().int().min(0).optional(),
  fuelLevel: z.string().optional(),
  notes: z.string().optional(),
  damageNotes: z.string().optional(),
  photos: z.array(z.string()).max(12).optional(),
  inspectorName: z.string().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await ctx.params;
    const body = schema.parse(await req.json());
    const result = await checkoutBooking({
      bookingId: id,
      organizationId: session.organizationId,
      ...body,
      inspectorName: body.inspectorName || session.name,
    });
    return NextResponse.json({
      ok: true,
      booking: result.booking,
      ledger: result.ledger,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg === "NOT_FOUND") {
      return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
    }
    if (msg === "NO_VEHICLE") {
      return NextResponse.json(
        { error: "Η κράτηση δεν έχει όχημα" },
        { status: 400 }
      );
    }
    if (msg === "INVALID_STATUS") {
      return NextResponse.json(
        { error: "Μη έγκυρη κατάσταση για παραλαβή" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Αποτυχία παραλαβής" }, { status: 400 });
  }
}
