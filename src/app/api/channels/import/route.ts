import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { canWriteOps } from "@/lib/permissions";
import { importExternalBooking } from "@/lib/channels";

const schema = z.object({
  channelId: z.string().optional().nullable(),
  externalRef: z.string().min(1).max(120),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  pickupAt: z.string().min(8),
  returnAt: z.string().min(8),
  vehicleId: z.string().optional().nullable(),
  totalAmount: z.coerce.number().min(0).optional(),
  notes: z.string().max(1000).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canWriteOps(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = schema.parse(await req.json());
    const booking = await importExternalBooking({
      organizationId: session.organizationId,
      channelId: body.channelId || undefined,
      externalRef: body.externalRef,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email || undefined,
      phone: body.phone,
      pickupAt: new Date(body.pickupAt),
      returnAt: new Date(body.returnAt),
      vehicleId: body.vehicleId || undefined,
      totalAmount: body.totalAmount,
      notes: body.notes,
    });
    return NextResponse.json({ ok: true, booking });
  } catch (e) {
    const code = e instanceof Error ? e.message : "ERROR";
    const map: Record<string, string> = {
      CONFLICT: "Το όχημα δεν είναι διαθέσιμο",
      VEHICLE_NOT_FOUND: "Όχημα δεν βρέθηκε",
      ORG_NOT_FOUND: "Οργανισμός δεν βρέθηκε",
    };
    return NextResponse.json(
      { error: map[code] || "Αποτυχία εισαγωγής" },
      { status: code === "CONFLICT" ? 409 : 400 }
    );
  }
}
