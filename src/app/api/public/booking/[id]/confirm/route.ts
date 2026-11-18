import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgStripe } from "@/lib/stripe";
import { sendBookingConfirmationEmail } from "@/lib/booking-email";

/**
 * Fallback επιβεβαίωση πληρωμής από success page (session_id),
 * όταν το webhook καθυστερεί ή δεν έχει ρυθμιστεί ακόμα.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as {
      sessionId?: string;
      token?: string;
    };
    if (!body.sessionId || !body.token) {
      return NextResponse.json({ error: "Λείπουν στοιχεία" }, { status: 400 });
    }

    const booking = await prisma.booking.findFirst({
      where: {
        id,
        organization: { publicToken: body.token },
      },
      include: {
        organization: {
          select: { stripeSecretKey: true, stripeChargesEnabled: true },
        },
        customer: true,
      },
    });
    if (!booking) {
      return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
    }

    if (booking.paymentStatus === "PAID") {
      return NextResponse.json({
        ok: true,
        alreadyPaid: true,
        code: booking.code,
        paymentStatus: booking.paymentStatus,
      });
    }

    if (!booking.organization.stripeSecretKey) {
      return NextResponse.json({ error: "No Stripe" }, { status: 400 });
    }

    const stripe = getOrgStripe(booking.organization.stripeSecretKey);
    const session = await stripe.checkout.sessions.retrieve(body.sessionId);
    if (session.metadata?.bookingId !== booking.id) {
      return NextResponse.json({ error: "Mismatch" }, { status: 400 });
    }
    if (session.payment_status !== "paid") {
      return NextResponse.json({
        ok: false,
        paymentStatus: booking.paymentStatus,
      });
    }

    const pi =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: "CONFIRMED",
        paymentStatus: "PAID",
        paidAt: new Date(),
        stripePaymentIntent: pi || undefined,
        stripeSessionId: session.id,
      },
    });

    void sendBookingConfirmationEmail(booking.id);

    return NextResponse.json({
      ok: true,
      code: booking.code,
      paymentStatus: "PAID",
    });
  } catch (e) {
    console.error("confirm payment", e);
    return NextResponse.json({ error: "Αποτυχία" }, { status: 400 });
  }
}
