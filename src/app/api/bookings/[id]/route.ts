import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import {
  cancelBooking,
  deleteBooking,
  rescheduleBooking,
} from "@/lib/bookings";
import { canWriteOps } from "@/lib/permissions";

const schema = z.object({
  action: z.enum(["cancel", "no_show", "reschedule"]).optional(),
  status: z.enum(["CANCELLED", "NO_SHOW"]).optional(),
  notes: z.string().max(2000).optional(),
  pickupAt: z.string().datetime().or(z.string().min(8)).optional(),
  returnAt: z.string().datetime().or(z.string().min(8)).optional(),
  vehicleId: z.string().nullable().optional(),
  dailyRate: z.coerce.number().positive().optional(),
  depositAmount: z.coerce.number().min(0).optional(),
  discountAmount: z.coerce.number().min(0).optional(),
  manualPricing: z.boolean().optional(),
});

const errorMap: Record<string, { status: number; error: string }> = {
  NOT_FOUND: { status: 404, error: "Δεν βρέθηκε" },
  INVALID_STATUS: {
    status: 400,
    error: "Η κατάσταση δεν επιτρέπει αυτή την ενέργεια",
  },
  CHECKED_OUT: {
    status: 400,
    error: "Κάνε πρώτα επιστροφή — δεν ακυρώνεται σε check-out",
  },
  INVALID_DATES: {
    status: 400,
    error:
      "Η ημερομηνία και ώρα επιστροφής πρέπει να είναι μεταγενέστερη της παραλαβής",
  },
  NO_VEHICLE: { status: 400, error: "Λείπει όχημα" },
  VEHICLE_NOT_FOUND: { status: 404, error: "Όχημα δεν βρέθηκε" },
  CONFLICT: {
    status: 409,
    error: "Το όχημα δεν είναι διαθέσιμο στο διάστημα",
  },
  INVALID_RATE: { status: 400, error: "Μη έγκυρη ημερήσια τιμή" },
};

function mapError(e: unknown) {
  const code = e instanceof Error ? e.message : "ERROR";
  return (
    errorMap[code] || {
      status: 400,
      error: "Αποτυχία ενημέρωσης",
    }
  );
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canWriteOps(session)) {
    return NextResponse.json(
      { error: "Δεν επιτρέπεται εγγραφή (μόνο ανάγνωση)" },
      { status: 403 }
    );
  }

  try {
    const { id } = await ctx.params;
    const body = schema.parse(await req.json());
    const hasPriceEdit =
      body.dailyRate != null ||
      body.depositAmount != null ||
      body.discountAmount != null ||
      body.manualPricing != null;

    const action =
      body.action ||
      (body.status === "NO_SHOW"
        ? "no_show"
        : body.status === "CANCELLED"
          ? "cancel"
          : body.pickupAt ||
              body.returnAt ||
              body.vehicleId !== undefined ||
              hasPriceEdit
            ? "reschedule"
            : null);

    if (!action) {
      return NextResponse.json({ error: "Λείπει action" }, { status: 400 });
    }

    if (action === "cancel" || action === "no_show") {
      const booking = await cancelBooking({
        bookingId: id,
        organizationId: session.organizationId,
        reason: action === "no_show" ? "NO_SHOW" : "CANCELLED",
        notes: body.notes,
      });
      return NextResponse.json({ ok: true, booking });
    }

    const booking = await rescheduleBooking({
      bookingId: id,
      organizationId: session.organizationId,
      pickupAt: body.pickupAt ? new Date(body.pickupAt) : undefined,
      returnAt: body.returnAt ? new Date(body.returnAt) : undefined,
      vehicleId: body.vehicleId,
      dailyRate: body.dailyRate,
      depositAmount: body.depositAmount,
      discountAmount: body.discountAmount,
      manualPricing: body.manualPricing ?? true,
    });
    return NextResponse.json({ ok: true, booking });
  } catch (e) {
    const mapped = mapError(e);
    return NextResponse.json(
      { error: mapped.error },
      { status: mapped.status }
    );
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canWriteOps(session)) {
    return NextResponse.json(
      { error: "Δεν επιτρέπεται εγγραφή (μόνο ανάγνωση)" },
      { status: 403 }
    );
  }

  try {
    const { id } = await ctx.params;
    await deleteBooking({
      bookingId: id,
      organizationId: session.organizationId,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapError(e);
    return NextResponse.json(
      { error: mapped.error },
      { status: mapped.status }
    );
  }
}
