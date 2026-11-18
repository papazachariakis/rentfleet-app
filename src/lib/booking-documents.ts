import { prisma } from "@/lib/prisma";

export type BookingDocPayload = {
  orgName: string;
  orgAfm?: string | null;
  orgDoy?: string | null;
  pytLicense?: string | null;
  code: string | null;
  pickupAt: Date;
  returnAt: Date;
  days: number;
  dailyRate: number;
  totalAmount: number;
  depositAmount: number;
  vatAmount: number;
  coverages: string[];
  notes?: string | null;
  customer: {
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    afm?: string | null;
    licenseNumber?: string | null;
    idDocumentNo?: string | null;
    isForeign: boolean;
  };
  vehicle?: {
    plateNumber: string;
    make: string;
    model: string;
    vehicleType: string;
    year?: number | null;
  } | null;
  pickupBranch?: string | null;
  agreement?: {
    signedAt?: Date | null;
    signerName?: string | null;
    termsVersion?: string;
    gdprSignedAt?: Date | null;
    gdprSignerName?: string | null;
    gdprVersion?: string;
  } | null;
};

export async function loadBookingDocPayload(
  bookingId: string,
  organizationId?: string
): Promise<BookingDocPayload | null> {
  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      ...(organizationId ? { organizationId } : {}),
    },
    include: {
      customer: true,
      vehicle: true,
      pickupBranch: true,
      agreement: true,
      organization: true,
    },
  });
  if (!booking) return null;

  let coverages: string[] = [];
  try {
    coverages = JSON.parse(booking.coveragesJson || "[]");
  } catch {
    coverages = [];
  }

  return {
    orgName: booking.organization.name,
    orgAfm: booking.organization.afm,
    orgDoy: booking.organization.doy,
    pytLicense: booking.organization.pytLicense,
    code: booking.code,
    pickupAt: booking.pickupAt,
    returnAt: booking.returnAt,
    days: booking.days,
    dailyRate: booking.dailyRate,
    totalAmount: booking.totalAmount,
    depositAmount: booking.depositAmount,
    vatAmount: booking.vatAmount,
    coverages,
    notes: booking.notes,
    customer: booking.customer,
    vehicle: booking.vehicle,
    pickupBranch: booking.pickupBranch?.name,
    agreement: booking.agreement,
  };
}
