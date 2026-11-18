import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { ensureAgreement } from "@/lib/bookings";

const schema = z.object({
  signerName: z.string().min(2),
  signatureData: z.string().min(10).optional(),
  driversJson: z.string().optional(),
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
    const booking = await prisma.booking.findFirst({
      where: { id, organizationId: session.organizationId },
      include: { customer: true },
    });
    if (!booking) {
      return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
    }

    const body = schema.parse(await req.json());
    await ensureAgreement(id);

    const agreement = await prisma.rentalAgreement.update({
      where: { bookingId: id },
      data: {
        signerName: body.signerName,
        signatureData: body.signatureData || `typed:${body.signerName}`,
        signedAt: new Date(),
        pdfUrl: `/api/bookings/${id}/agreement/pdf`,
        driversJson:
          body.driversJson ||
          JSON.stringify([
            {
              name: `${booking.customer.firstName} ${booking.customer.lastName}`,
              license: booking.customer.licenseNumber,
            },
          ]),
      },
    });

    return NextResponse.json({ ok: true, agreement });
  } catch {
    return NextResponse.json({ error: "Αποτυχία υπογραφής" }, { status: 400 });
  }
}
