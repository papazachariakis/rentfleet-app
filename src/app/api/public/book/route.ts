import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createOnlineBookingDraft } from "@/lib/public-booking";
import { ensureAgreement } from "@/lib/bookings";
import { sendBookingConfirmationEmail } from "@/lib/booking-email";
import {
  appOrigin,
  getOrgStripe,
  orgCanAcceptPayments,
} from "@/lib/stripe";

const schema = z.object({
  token: z.string().min(4),
  categoryId: z.string().min(1),
  vehicleId: z.string().optional().nullable(),
  pickupAt: z.string().min(1),
  returnAt: z.string().min(1),
  pickupBranchId: z.string().optional().nullable(),
  returnBranchId: z.string().optional().nullable(),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email(),
  phone: z.string().min(8).max(30).optional().or(z.literal("")),
  afm: z.string().max(20).optional().nullable().or(z.literal("")),
  licenseNumber: z.string().max(40).optional().or(z.literal("")),
  licenseCategories: z.string().max(300).optional().or(z.literal("")),
  idDocumentNo: z.string().min(3).max(40),
  coverages: z.array(z.string()).optional(),
  extraIds: z.array(z.string()).optional(),
  notes: z.string().max(500).optional(),
  licenseFrontImage: z.string().max(8_000_000).optional().nullable(),
  licenseBackImage: z.string().max(8_000_000).optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const org = await prisma.organization.findUnique({
      where: { publicToken: body.token },
      select: {
        id: true,
        name: true,
        vatCategory: true,
        publicToken: true,
        stripeSecretKey: true,
        stripeChargesEnabled: true,
      },
    });
    if (!org) {
      return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
    }

    const pickupAt = new Date(body.pickupAt);
    const returnAt = new Date(body.returnAt);
    if (Number.isNaN(pickupAt.getTime()) || Number.isNaN(returnAt.getTime())) {
      return NextResponse.json(
        { error: "Μη έγκυρες ημερομηνίες" },
        { status: 400 }
      );
    }
    if (!(returnAt > pickupAt)) {
      return NextResponse.json(
        {
          error:
            "Η ημερομηνία και ώρα επιστροφής πρέπει να είναι μεταγενέστερη της παραλαβής",
        },
        { status: 400 }
      );
    }

    const category = await prisma.vehicleCategory.findFirst({
      where: {
        id: body.categoryId,
        organizationId: org.id,
        active: true,
      },
    });
    if (!category) {
      return NextResponse.json(
        { error: "Κατηγορία δεν βρέθηκε" },
        { status: 404 }
      );
    }

    const takePayment = orgCanAcceptPayments(org);
    const created = await createOnlineBookingDraft({
      org,
      categoryId: body.categoryId,
      vehicleId: body.vehicleId || null,
      pickupAt,
      returnAt,
      pickupBranchId: body.pickupBranchId,
      returnBranchId: body.returnBranchId || body.pickupBranchId,
      coverages: body.coverages,
      extraIds: body.extraIds,
      notes: body.notes,
      pendingPayment: takePayment,
      customer: {
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        email: body.email.trim(),
        phone: body.phone?.trim() || undefined,
        afm: body.afm?.trim() || null,
        licenseNumber: body.licenseNumber?.trim() || undefined,
        licenseCategories: body.licenseCategories?.trim() || undefined,
        idDocumentNo: body.idDocumentNo.trim(),
      },
      licenseFrontImage: body.licenseFrontImage || null,
      licenseBackImage: body.licenseBackImage || null,
    });

    if ("error" in created) {
      if (created.error === "LICENSE_INVALID") {
        return NextResponse.json(
          {
            error:
              "message" in created
                ? created.message
                : "Το δίπλωμα δεν επιτρέπει αυτή την κατηγορία οχήματος",
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        {
          error:
            "Δεν υπάρχει διαθέσιμο όχημα σε αυτή την κατηγορία για τις ημερομηνίες.",
        },
        { status: 409 }
      );
    }

    const { booking, priced } = created;
    await ensureAgreement(booking.id);
    if (!takePayment) {
      void sendBookingConfirmationEmail(booking.id);
      return NextResponse.json({
        ok: true,
        paid: false,
        bookingId: booking.id,
        code: booking.code,
        totalAmount: priced.totalAmount,
        days: priced.days,
        redirectTo: `/book/${body.token}/success?booking=${booking.id}`,
      });
    }

    const origin = appOrigin(req);
    const stripe = getOrgStripe(org.stripeSecretKey);

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: body.email.trim(),
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: Math.round(priced.totalAmount * 100),
              product_data: {
                name: `${category.name} · ${priced.days} ημέρες`,
                description: `${booking.vehicle?.plateNumber || category.name} · ${pickupAt.toISOString().slice(0, 10)} → ${returnAt.toISOString().slice(0, 10)}`,
              },
            },
          },
        ],
        payment_intent_data: {
          metadata: {
            bookingId: booking.id,
            organizationId: org.id,
          },
        },
        metadata: {
          bookingId: booking.id,
          organizationId: org.id,
          publicToken: body.token,
        },
        success_url: `${origin}/book/${body.token}/success?booking=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/book/${body.token}?cancelled=1`,
        expires_at: Math.floor(Date.now() / 1000) + 60 * 30,
      });

      await prisma.booking.update({
        where: { id: booking.id },
        data: { stripeSessionId: session.id },
      });

      return NextResponse.json({
        ok: true,
        paid: false,
        checkoutUrl: session.url,
        bookingId: booking.id,
        code: booking.code,
        totalAmount: priced.totalAmount,
      });
    } catch (err) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: "CANCELLED",
          paymentStatus: "FAILED",
          licenseScanPdf: null,
          licenseScanCreatedAt: null,
        },
      });
      console.error("stripe checkout error", err);
      return NextResponse.json(
        { error: "Αποτυχία Stripe checkout. Έλεγξε τα keys στο /payments." },
        { status: 502 }
      );
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Μη έγκυρα στοιχεία φόρμας" },
        { status: 400 }
      );
    }
    console.error("public book error", e);
    return NextResponse.json({ error: "Αποτυχία κράτησης" }, { status: 400 });
  }
}
