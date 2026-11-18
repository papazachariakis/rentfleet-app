import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { openSecret } from "@/lib/secret-box";
import { getOrgStripe } from "@/lib/stripe";
import { sendBookingConfirmationEmail } from "@/lib/booking-email";

export const runtime = "nodejs";

async function confirmPaidBooking(bookingId: string, paymentIntentId?: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.paymentStatus === "PAID") return;

  await prisma.booking.updateMany({
    where: { id: booking.id, paymentStatus: { not: "PAID" } },
    data: {
      status: "CONFIRMED",
      paymentStatus: "PAID",
      paidAt: new Date(),
      stripePaymentIntent: paymentIntentId || booking.stripePaymentIntent,
    },
  });
  void sendBookingConfirmationEmail(bookingId);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await ctx.params;
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      stripeSecretKey: true,
      stripeWebhookSecret: true,
    },
  });
  if (!org?.stripeSecretKey || !org.stripeWebhookSecret) {
    return NextResponse.json(
      { error: "Stripe δεν έχει ρυθμιστεί για αυτόν τον οργανισμό" },
      { status: 400 }
    );
  }

  const whsec = openSecret(org.stripeWebhookSecret);
  if (!whsec) {
    return NextResponse.json({ error: "Invalid webhook secret" }, { status: 400 });
  }

  const stripe = getOrgStripe(org.stripeSecretKey);
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, whsec);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (
        session.metadata?.organizationId &&
        session.metadata.organizationId !== orgId
      ) {
        return NextResponse.json({ error: "Org mismatch" }, { status: 400 });
      }
      const bookingId = session.metadata?.bookingId;
      if (bookingId && session.payment_status === "paid") {
        const pi =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;
        await confirmPaidBooking(bookingId, pi);
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.bookingId;
      if (bookingId) {
        await prisma.booking.updateMany({
          where: {
            id: bookingId,
            organizationId: orgId,
            paymentStatus: "PENDING",
            status: "PENDING_PAYMENT",
          },
          data: {
            status: "CANCELLED",
            paymentStatus: "FAILED",
            licenseScanPdf: null,
            licenseScanCreatedAt: null,
          },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("org stripe webhook error", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
