import { prisma } from "@/lib/prisma";
import {
  findVehicleConflicts,
  priceRental,
  makeBookingCode,
  loadOrgPriceRules,
} from "@/lib/bookings";
import { calcExtrasTotal, resolveVehicleRates } from "@/lib/pricing";
import { checkLicenseForVehicleType } from "@/lib/license-categories";
import { rentalDays } from "@/lib/utils";

export async function findAvailableVehicles(input: {
  organizationId: string;
  categoryId: string;
  pickupAt: Date;
  returnAt: Date;
  preferredBranchId?: string | null;
}) {
  const vehicles = await prisma.vehicle.findMany({
    where: {
      organizationId: input.organizationId,
      categoryId: input.categoryId,
      active: true,
      status: { in: ["AVAILABLE", "RENTED"] },
    },
    include: { category: true, branch: true },
    orderBy: { plateNumber: "asc" },
  });

  const free = [];
  for (const vehicle of vehicles) {
    const conflicts = await findVehicleConflicts({
      vehicleId: vehicle.id,
      pickupAt: input.pickupAt,
      returnAt: input.returnAt,
    });
    if (!conflicts.hasConflict) free.push(vehicle);
  }

  return free.sort((a, b) => {
    if (!input.preferredBranchId) return 0;
    const aHit = a.branchId === input.preferredBranchId ? 0 : 1;
    const bHit = b.branchId === input.preferredBranchId ? 0 : 1;
    return aHit - bHit;
  });
}

export async function findAvailableVehicle(input: {
  organizationId: string;
  categoryId: string;
  pickupAt: Date;
  returnAt: Date;
  preferredBranchId?: string | null;
  vehicleId?: string | null;
}) {
  if (input.vehicleId) {
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: input.vehicleId,
        organizationId: input.organizationId,
        categoryId: input.categoryId,
        active: true,
        status: { in: ["AVAILABLE", "RENTED"] },
      },
      include: { category: true, branch: true },
    });
    if (!vehicle) return null;
    const conflicts = await findVehicleConflicts({
      vehicleId: vehicle.id,
      pickupAt: input.pickupAt,
      returnAt: input.returnAt,
    });
    return conflicts.hasConflict ? null : vehicle;
  }

  const list = await findAvailableVehicles(input);
  return list[0] || null;
}

export async function createOnlineBookingDraft(input: {
  org: {
    id: string;
    name: string;
    vatCategory: number;
    publicToken: string | null;
  };
  categoryId: string;
  vehicleId?: string | null;
  pickupAt: Date;
  returnAt: Date;
  pickupBranchId?: string | null;
  returnBranchId?: string | null;
  coverages?: string[];
  extraIds?: string[];
  notes?: string;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    afm?: string | null;
    isForeign?: boolean;
    licenseNumber?: string;
    licenseCategories?: string;
    idDocumentNo?: string;
  };
  pendingPayment: boolean;
  licenseFrontImage?: string | null;
  licenseBackImage?: string | null;
}) {
  const vehicle = await findAvailableVehicle({
    organizationId: input.org.id,
    categoryId: input.categoryId,
    pickupAt: input.pickupAt,
    returnAt: input.returnAt,
    preferredBranchId: input.pickupBranchId,
    vehicleId: input.vehicleId,
  });
  if (!vehicle) return { error: "NO_VEHICLE" as const };

  if (input.customer.licenseCategories?.trim()) {
    const licenseCheck = checkLicenseForVehicleType({
      vehicleType: vehicle.vehicleType,
      licenseCategories: input.customer.licenseCategories,
      pickupAt: input.pickupAt,
      vehicleTransmission: vehicle.category?.transmission,
      requireCategories: true,
    });
    if (!licenseCheck.ok) {
      return {
        error: "LICENSE_INVALID" as const,
        message: licenseCheck.message,
      };
    }
  }

  const { dailyRate, depositAmount } = resolveVehicleRates(vehicle);
  const rules = await loadOrgPriceRules(input.org.id, input.categoryId);

  const selectedExtras = input.extraIds?.length
    ? await prisma.extra.findMany({
        where: {
          id: { in: input.extraIds },
          organizationId: input.org.id,
          active: true,
        },
      })
    : [];

  const daysPreview = rentalDays(input.pickupAt, input.returnAt);
  const extrasTotal = calcExtrasTotal(
    selectedExtras.map((e) => ({
      dailyRate: e.dailyRate,
      flatRate: e.flatRate,
      quantity: 1,
    })),
    daysPreview
  );

  const priced = priceRental({
    dailyRate,
    pickupAt: input.pickupAt,
    returnAt: input.returnAt,
    depositAmount,
    extrasTotal,
    vatCategory: input.org.vatCategory,
    rules,
    categoryId: input.categoryId,
  });

  const customer = await prisma.customer.create({
    data: {
      firstName: input.customer.firstName,
      lastName: input.customer.lastName,
      email: input.customer.email,
      phone: input.customer.phone || null,
      afm: input.customer.afm || null,
      isForeign: input.customer.isForeign ?? !input.customer.afm,
      licenseNumber: input.customer.licenseNumber || null,
      licenseCategories: input.customer.licenseCategories || null,
      idDocumentNo: input.customer.idDocumentNo || null,
      organizationId: input.org.id,
    },
  });

  const booking = await prisma.booking.create({
    data: {
      code: makeBookingCode(input.org.name),
      channel: "ONLINE",
      status: input.pendingPayment ? "PENDING_PAYMENT" : "CONFIRMED",
      pickupAt: input.pickupAt,
      returnAt: input.returnAt,
      pickupPlace: vehicle.branch?.name,
      returnPlace: vehicle.branch?.name,
      dailyRate: priced.averageDaily || dailyRate,
      days: priced.days,
      extrasTotal: priced.extrasTotal,
      subtotal: priced.subtotal,
      vatAmount: priced.vatAmount,
      totalAmount: priced.totalAmount,
      depositAmount: priced.depositAmount,
      paymentStatus: input.pendingPayment ? "PENDING" : "UNPAID",
      coveragesJson: JSON.stringify(input.coverages || ["CDW"]),
      notes: input.notes,
      customerId: customer.id,
      vehicleId: vehicle.id,
      pickupBranchId: input.pickupBranchId || vehicle.branchId,
      returnBranchId:
        input.returnBranchId || input.pickupBranchId || vehicle.branchId,
      organizationId: input.org.id,
      extras: {
        create: selectedExtras.map((e) => {
          const unit =
            e.flatRate != null && e.flatRate > 0
              ? e.flatRate
              : e.dailyRate * priced.days;
          return {
            extraId: e.id,
            quantity: 1,
            unitPrice: unit,
            total: unit,
          };
        }),
      },
    },
    include: { customer: true, vehicle: true, organization: true },
  });

  if (input.licenseFrontImage) {
    try {
      const { buildLicenseScanPdf } = await import("@/lib/license-scan-pdf");
      const pdf = await buildLicenseScanPdf({
        frontImageDataUrl: input.licenseFrontImage,
        backImageDataUrl: input.licenseBackImage,
        bookingCode: booking.code,
        customerName: `${customer.firstName} ${customer.lastName}`,
      });
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          licenseScanPdf: new Uint8Array(pdf),
          licenseScanCreatedAt: new Date(),
        },
      });
    } catch (e) {
      console.error("license scan pdf online", e);
    }
  }

  return { booking, vehicle, priced };
}
