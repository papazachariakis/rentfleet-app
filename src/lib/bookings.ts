import { prisma } from "@/lib/prisma";
import { rentalDays } from "@/lib/utils";
import { vatRate, splitGross } from "@/lib/aade/mydata";
import {
  resolveClientLedgerMode,
  submitDeparture,
  submitReturn,
} from "@/lib/aade/client-ledger";
import { makeBookingCode } from "@/lib/booking-code";
import {
  rentalSubtotalWithRules,
  type PriceRuleLike,
} from "@/lib/pricing";

/** Statuses that hold inventory (block the vehicle). */
export const BLOCKING_STATUSES = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "CHECKED_OUT",
] as const;

export async function findVehicleConflicts(input: {
  vehicleId: string;
  pickupAt: Date;
  returnAt: Date;
  excludeBookingId?: string;
}) {
  const overlapping = await prisma.booking.findMany({
    where: {
      vehicleId: input.vehicleId,
      status: { in: [...BLOCKING_STATUSES] },
      id: input.excludeBookingId ? { not: input.excludeBookingId } : undefined,
      pickupAt: { lt: input.returnAt },
      returnAt: { gt: input.pickupAt },
    },
    select: { id: true, code: true, pickupAt: true, returnAt: true, status: true },
  });
  return { hasConflict: overlapping.length > 0, overlapping };
}

/** Ακύρωση / no-show — ελευθερώνει όχημα αν ήταν RENTED */
export async function cancelBooking(input: {
  bookingId: string;
  organizationId: string;
  reason?: "CANCELLED" | "NO_SHOW";
  notes?: string;
}) {
  const booking = await prisma.booking.findFirst({
    where: { id: input.bookingId, organizationId: input.organizationId },
    include: { vehicle: true },
  });
  if (!booking) throw new Error("NOT_FOUND");
  if (["CANCELLED", "NO_SHOW", "CHECKED_IN"].includes(booking.status)) {
    throw new Error("INVALID_STATUS");
  }

  const status = input.reason || "CANCELLED";
  const forceNote =
    booking.status === "CHECKED_OUT"
      ? "Ακυρώθηκε μετά από check-out (χειροκίνητα)"
      : null;
  const notes =
    [booking.notes, input.notes, forceNote].filter(Boolean).join(" · ") ||
    null;

  const updated = await prisma.$transaction(async (tx) => {
    const b = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status,
        notes,
        licenseScanPdf: null,
        licenseScanCreatedAt: null,
        ...(booking.paymentStatus === "PENDING"
          ? { paymentStatus: "FAILED" }
          : {}),
      },
    });
    if (booking.vehicleId && booking.vehicle?.status === "RENTED") {
      const otherOpen = await tx.booking.count({
        where: {
          vehicleId: booking.vehicleId,
          status: "CHECKED_OUT",
          id: { not: booking.id },
        },
      });
      if (otherOpen === 0) {
        await tx.vehicle.update({
          where: { id: booking.vehicleId },
          data: { status: "AVAILABLE" },
        });
      }
    }
    return b;
  });

  return updated;
}

/** Οριστική διαγραφή — μόνο DRAFT / CANCELLED / NO_SHOW */
export async function deleteBooking(input: {
  bookingId: string;
  organizationId: string;
}) {
  const booking = await prisma.booking.findFirst({
    where: { id: input.bookingId, organizationId: input.organizationId },
    include: { vehicle: true },
  });
  if (!booking) throw new Error("NOT_FOUND");
  if (!["DRAFT", "CANCELLED", "NO_SHOW"].includes(booking.status)) {
    throw new Error("INVALID_STATUS");
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoice.updateMany({
      where: { bookingId: booking.id },
      data: { bookingId: null },
    });
    await tx.booking.delete({ where: { id: booking.id } });
    if (booking.vehicleId && booking.vehicle?.status === "RENTED") {
      const otherOpen = await tx.booking.count({
        where: {
          vehicleId: booking.vehicleId,
          status: "CHECKED_OUT",
        },
      });
      if (otherOpen === 0) {
        await tx.vehicle.update({
          where: { id: booking.vehicleId },
          data: { status: "AVAILABLE" },
        });
      }
    }
  });

  return { ok: true as const };
}

/** Αλλαγή ημερομηνιών / οχήματος / τιμής desk με έλεγχο διαθεσιμότητας */
export async function rescheduleBooking(input: {
  bookingId: string;
  organizationId: string;
  pickupAt?: Date;
  returnAt?: Date;
  vehicleId?: string | null;
  /** Συμφωνημένη ημερήσια τιμή desk (override καταλόγου) */
  dailyRate?: number;
  depositAmount?: number;
  discountAmount?: number;
  /**
   * true = σταθερή τιμή συμφωνίας (χωρίς κανόνες περιόδου).
   * Default true όταν δίνεται dailyRate ή όταν κρατάμε την υπάρχουσα τιμή κράτησης.
   */
  manualPricing?: boolean;
}) {
  const booking = await prisma.booking.findFirst({
    where: { id: input.bookingId, organizationId: input.organizationId },
    include: {
      vehicle: { include: { category: true } },
      organization: true,
      extras: true,
    },
  });
  if (!booking) throw new Error("NOT_FOUND");
  if (!["DRAFT", "PENDING_PAYMENT", "CONFIRMED"].includes(booking.status)) {
    throw new Error("INVALID_STATUS");
  }

  const pickupAt = input.pickupAt || booking.pickupAt;
  const returnAt = input.returnAt || booking.returnAt;
  if (returnAt <= pickupAt) throw new Error("INVALID_DATES");

  const vehicleId =
    input.vehicleId !== undefined ? input.vehicleId : booking.vehicleId;
  if (!vehicleId) throw new Error("NO_VEHICLE");

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, organizationId: input.organizationId, active: true },
    include: { category: true },
  });
  if (!vehicle) throw new Error("VEHICLE_NOT_FOUND");

  const conflicts = await findVehicleConflicts({
    vehicleId,
    pickupAt,
    returnAt,
    excludeBookingId: booking.id,
  });
  if (conflicts.hasConflict) throw new Error("CONFLICT");

  const dailyRate =
    input.dailyRate != null && input.dailyRate > 0
      ? input.dailyRate
      : booking.dailyRate;
  if (!(dailyRate > 0)) throw new Error("INVALID_RATE");

  const depositAmount =
    input.depositAmount != null
      ? input.depositAmount
      : booking.depositAmount;
  const discountAmount =
    input.discountAmount != null
      ? input.discountAmount
      : booking.discountAmount;

  const manualPricing = input.manualPricing ?? true;
  const rules = manualPricing
    ? []
    : await loadOrgPriceRules(input.organizationId, vehicle.categoryId);

  const priced = priceRental({
    dailyRate,
    pickupAt,
    returnAt,
    extrasTotal: booking.extrasTotal,
    insuranceTotal: booking.insuranceTotal,
    discountAmount,
    vatCategory: booking.organization.vatCategory,
    depositAmount,
    rules,
    categoryId: vehicle.categoryId,
  });

  return prisma.booking.update({
    where: { id: booking.id },
    data: {
      pickupAt,
      returnAt,
      vehicleId,
      dailyRate: priced.averageDaily || dailyRate,
      days: priced.days,
      discountAmount,
      subtotal: priced.subtotal,
      vatAmount: priced.vatAmount,
      totalAmount: priced.totalAmount,
      depositAmount: priced.depositAmount,
    },
  });
}

/** Επανυποβολή Ψηφιακού Πελατολογίου (αναχώρηση ή επιστροφή) */
export async function retryLedgerSubmission(input: {
  bookingId: string;
  organizationId: string;
}) {
  const booking = await prisma.booking.findFirst({
    where: { id: input.bookingId, organizationId: input.organizationId },
    include: {
      vehicle: true,
      customer: true,
      pickupBranch: true,
      returnBranch: true,
      organization: true,
    },
  });
  if (!booking) throw new Error("NOT_FOUND");
  if (!booking.vehicle) throw new Error("NO_VEHICLE");
  if (!["CHECKED_OUT", "CHECKED_IN"].includes(booking.status)) {
    throw new Error("INVALID_STATUS");
  }
  if (
    booking.aadeLedgerStatus !== "FAILED" &&
    booking.aadeLedgerStatus !== "PENDING"
  ) {
    throw new Error("NOT_RETRYABLE");
  }

  const mode = resolveClientLedgerMode(booking.organization.clientLedgerMode);

  // Επιστροφή: retry return αν υπάρχει ledgerId μετά το check-in
  if (booking.status === "CHECKED_IN" && booking.aadeLedgerId) {
    const returnAt = booking.aadeReturnAt || new Date();
    const ledger = await submitReturn(mode, {
      ledgerId: booking.aadeLedgerId,
      returnAt,
      returnPlace:
        booking.returnPlace || booking.returnBranch?.name || undefined,
      documentType: "ALP",
    });
    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        aadeLedgerStatus: ledger.ok ? "OK" : "FAILED",
        aadeReturnAt: returnAt,
      },
    });
    return { booking: updated, ledger, kind: "return" as const };
  }

  // Παραλαβή: επανυποβολή αναχώρησης
  const departureAt = booking.aadeDepartureAt || new Date();
  const ledger = await submitDeparture(mode, {
    entityVatNumber: booking.organization.afm || undefined,
    branch: booking.pickupBranch?.aadeBranchCode ?? 0,
    plateNumber: booking.vehicle.plateNumber,
    make: booking.vehicle.make,
    vehicleCategory: booking.vehicle.vehicleType,
    departureAt,
    pickupPlace: booking.pickupPlace || booking.pickupBranch?.name || undefined,
    movementPurpose: "rental",
    serviceType: "once",
    customerAfm: booking.customer.afm || undefined,
    agreedAmount: booking.totalAmount,
  });
  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      aadeLedgerId: ledger.ledgerId || booking.aadeLedgerId,
      aadeLedgerStatus: ledger.ok ? "OK" : "FAILED",
      aadeDepartureAt: departureAt,
    },
  });
  return { booking: updated, ledger, kind: "departure" as const };
}

export function priceRental(input: {
  dailyRate: number;
  pickupAt: Date;
  returnAt: Date;
  extrasTotal?: number;
  insuranceTotal?: number;
  discountAmount?: number;
  vatCategory?: number;
  depositAmount?: number;
  /** Κενό = σταθερή ημερήσια (desk override / χωρίς κανόνες περιόδου) */
  rules?: PriceRuleLike[];
  categoryId?: string | null;
}) {
  const rules = input.rules || [];
  const priced = rentalSubtotalWithRules(
    input.dailyRate,
    input.pickupAt,
    input.returnAt,
    rules,
    input.categoryId
  );
  const days = priced.days || rentalDays(input.pickupAt, input.returnAt);
  const extras = input.extrasTotal || 0;
  const insurance = input.insuranceTotal || 0;
  const discount = input.discountAmount || 0;
  const grossBeforeVat =
    priced.rentalGross + extras + insurance - discount;
  const totalAmount = Math.max(0, Math.round(grossBeforeVat * 100) / 100);
  const vatCategory = input.vatCategory ?? 1;
  // τιμές θεωρούνται μικτές (με ΦΠΑ) όπως συνηθίζεται στο rent-a-car GR
  const { net, vat } = splitGross(totalAmount, vatCategory);
  return {
    days,
    averageDaily: priced.averageDaily,
    rentalGross: priced.rentalGross,
    extrasTotal: extras,
    subtotal: net,
    vatAmount: vat,
    totalAmount,
    depositAmount: input.depositAmount ?? 0,
    vatCategory,
    vatRate: vatRate(vatCategory),
  };
}

export async function loadOrgPriceRules(
  organizationId: string,
  categoryId?: string | null
) {
  return prisma.priceRule.findMany({
    where: {
      organizationId,
      active: true,
      OR: [{ categoryId: null }, ...(categoryId ? [{ categoryId }] : [])],
    },
  });
}

export async function ensureAgreement(bookingId: string) {
  const existing = await prisma.rentalAgreement.findUnique({
    where: { bookingId },
  });
  if (existing) return existing;
  return prisma.rentalAgreement.create({
    data: { bookingId, termsVersion: "1.1", gdprVersion: "1.0" },
  });
}

/** Παραλαβή: inspection + ΑΑΔΕ πελατολόγιο αναχώρησης + status CHECKED_OUT */
export async function checkoutBooking(input: {
  bookingId: string;
  organizationId: string;
  odometerKm?: number;
  fuelLevel?: string;
  notes?: string;
  damageNotes?: string;
  photos?: string[];
  inspectorName?: string;
}) {
  const booking = await prisma.booking.findFirst({
    where: { id: input.bookingId, organizationId: input.organizationId },
    include: {
      vehicle: true,
      customer: true,
      pickupBranch: true,
      organization: true,
    },
  });
  if (!booking) throw new Error("NOT_FOUND");
  if (!booking.vehicle) throw new Error("NO_VEHICLE");
  if (["CANCELLED", "CHECKED_IN"].includes(booking.status)) {
    throw new Error("INVALID_STATUS");
  }

  const mode = resolveClientLedgerMode(booking.organization.clientLedgerMode);
  const departureAt = new Date();
  const ledger = await submitDeparture(mode, {
    entityVatNumber: booking.organization.afm || undefined,
    branch: booking.pickupBranch?.aadeBranchCode ?? 0,
    plateNumber: booking.vehicle.plateNumber,
    make: booking.vehicle.make,
    vehicleCategory: booking.vehicle.vehicleType,
    departureAt,
    pickupPlace: booking.pickupPlace || booking.pickupBranch?.name || undefined,
    movementPurpose: "rental",
    serviceType: "once",
    customerAfm: booking.customer.afm || undefined,
    agreedAmount: booking.totalAmount,
  });

  const [, updated] = await prisma.$transaction([
    prisma.inspection.create({
      data: {
        bookingId: booking.id,
        kind: "PICKUP",
        odometerKm: input.odometerKm,
        fuelLevel: input.fuelLevel,
        notes: input.notes,
        damageNotes: input.damageNotes,
        photos: input.photos || [],
        inspectorName: input.inspectorName,
        inspectedAt: departureAt,
      },
    }),
    prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: "CHECKED_OUT",
        aadeDepartureAt: departureAt,
        aadeLedgerId: ledger.ledgerId || booking.aadeLedgerId,
        aadeLedgerStatus: ledger.ok ? "OK" : "FAILED",
      },
    }),
    prisma.vehicle.update({
      where: { id: booking.vehicle.id },
      data: {
        status: "RENTED",
        odometerKm: input.odometerKm ?? booking.vehicle.odometerKm,
        fuelLevel: input.fuelLevel ?? booking.vehicle.fuelLevel,
      },
    }),
  ]);

  await ensureAgreement(booking.id);

  return { booking: updated, ledger };
}

/** Επιστροφή: inspection + ΑΑΔΕ επιστροφή + status CHECKED_IN */
export async function checkinBooking(input: {
  bookingId: string;
  organizationId: string;
  odometerKm?: number;
  fuelLevel?: string;
  notes?: string;
  damageNotes?: string;
  photos?: string[];
  inspectorName?: string;
  documentType?: "ALP" | "INVOICE" | "ALP_FHM";
}) {
  const booking = await prisma.booking.findFirst({
    where: { id: input.bookingId, organizationId: input.organizationId },
    include: {
      vehicle: true,
      returnBranch: true,
      organization: true,
    },
  });
  if (!booking) throw new Error("NOT_FOUND");
  if (!booking.vehicle) throw new Error("NO_VEHICLE");
  if (booking.status !== "CHECKED_OUT") throw new Error("INVALID_STATUS");

  const mode = resolveClientLedgerMode(booking.organization.clientLedgerMode);
  const returnAt = new Date();
  let ledgerStatus = booking.aadeLedgerStatus;
  let ledgerResult = null;

  if (booking.aadeLedgerId) {
    ledgerResult = await submitReturn(mode, {
      ledgerId: booking.aadeLedgerId,
      returnAt,
      returnPlace:
        booking.returnPlace || booking.returnBranch?.name || undefined,
      documentType: input.documentType || "ALP",
    });
    ledgerStatus = ledgerResult.ok ? "OK" : "FAILED";
  }

  const [inspection] = await prisma.$transaction([
    prisma.inspection.create({
      data: {
        bookingId: booking.id,
        kind: "RETURN",
        odometerKm: input.odometerKm,
        fuelLevel: input.fuelLevel,
        notes: input.notes,
        damageNotes: input.damageNotes,
        photos: input.photos || [],
        inspectorName: input.inspectorName,
        inspectedAt: returnAt,
      },
    }),
    prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: "CHECKED_IN",
        aadeReturnAt: returnAt,
        aadeLedgerStatus: ledgerStatus,
        // Διαγραφή σάρωσης διπλώματος μετά την ολοκλήρωση επιστροφής
        licenseScanPdf: null,
        licenseScanCreatedAt: null,
      },
    }),
    prisma.vehicle.update({
      where: { id: booking.vehicle.id },
      data: {
        status: "AVAILABLE",
        odometerKm: input.odometerKm ?? booking.vehicle.odometerKm,
        fuelLevel: input.fuelLevel ?? booking.vehicle.fuelLevel,
      },
    }),
  ]);

  let invoice = null;
  try {
    const { issueInvoiceForBooking } = await import("@/lib/invoices");
    invoice = await issueInvoiceForBooking(booking.id);
  } catch (e) {
    console.error("invoice on checkin", e);
  }

  return { inspection, ledger: ledgerResult, invoice };
}

export { makeBookingCode };
