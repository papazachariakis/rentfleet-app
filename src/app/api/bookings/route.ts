import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  findVehicleConflicts,
  priceRental,
  makeBookingCode,
  ensureAgreement,
  loadOrgPriceRules,
} from "@/lib/bookings";
import { calcExtrasTotal, resolveVehicleRates } from "@/lib/pricing";
import { sendBookingConfirmationEmail } from "@/lib/booking-email";
import { canWriteOps } from "@/lib/permissions";
import { checkLicenseForVehicleType } from "@/lib/license-categories";
import { buildLicenseScanPdf } from "@/lib/license-scan-pdf";
import { rentalDays } from "@/lib/utils";

const schema = z.object({
  vehicleId: z.string().min(1),
  customerId: z.string().optional(),
  /** Νέος πελάτης αν δεν δοθεί customerId */
  customer: z
    .object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email().optional().or(z.literal("")),
      phone: z.string().optional(),
      afm: z.string().optional(),
      isForeign: z.boolean().optional(),
      licenseNumber: z.string().optional(),
      licenseCategories: z.string().optional(),
      licenseCountry: z.string().optional(),
      idDocumentNo: z.string().optional(),
    })
    .optional(),
  pickupAt: z.string().min(1),
  returnAt: z.string().min(1),
  pickupBranchId: z.string().optional().nullable(),
  returnBranchId: z.string().optional().nullable(),
  dailyRate: z.coerce.number().positive().optional(),
  depositAmount: z.coerce.number().min(0).optional(),
  coverages: z.array(z.string()).optional(),
  extraIds: z.array(z.string()).optional(),
  notes: z.string().optional(),
  paymentStatus: z.enum(["UNPAID", "PAID", "PARTIAL"]).optional(),
  licenseFrontImage: z.string().max(8_000_000).optional().nullable(),
  licenseBackImage: z.string().max(8_000_000).optional().nullable(),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bookings = await prisma.booking.findMany({
    where: { organizationId: session.organizationId },
    include: {
      customer: true,
      vehicle: true,
      pickupBranch: true,
    },
    orderBy: { pickupAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ bookings });
}

export async function POST(req: Request) {
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
    const body = schema.parse(await req.json());
    const orgId = session.organizationId;

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: body.vehicleId, organizationId: orgId, active: true },
      include: { category: true, branch: true },
    });
    if (!vehicle) {
      return NextResponse.json({ error: "Όχημα δεν βρέθηκε" }, { status: 404 });
    }

    const pickupAt = new Date(body.pickupAt);
    const returnAt = new Date(body.returnAt);
    if (Number.isNaN(pickupAt.getTime()) || Number.isNaN(returnAt.getTime())) {
      return NextResponse.json(
        { error: "Μη έγκυρες ημερομηνίες παραλαβής/επιστροφής" },
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

    const conflicts = await findVehicleConflicts({
      vehicleId: vehicle.id,
      pickupAt,
      returnAt,
    });
    if (conflicts.hasConflict) {
      return NextResponse.json(
        {
          error: "Το όχημα είναι ήδη κλεισμένο για αυτές τις ημερομηνίες",
          conflicts,
        },
        { status: 409 }
      );
    }

    let customerId = body.customerId;
    let licenseCategoriesForCheck =
      body.customer?.licenseCategories?.trim() || "";

    if (!customerId) {
      if (!body.customer) {
        return NextResponse.json(
          { error: "Απαιτείται πελάτης" },
          { status: 400 }
        );
      }
      const created = await prisma.customer.create({
        data: {
          firstName: body.customer.firstName,
          lastName: body.customer.lastName,
          email: body.customer.email || null,
          phone: body.customer.phone || null,
          afm: body.customer.afm || null,
          isForeign: body.customer.isForeign || false,
          licenseNumber: body.customer.licenseNumber || null,
          licenseCategories: body.customer.licenseCategories || null,
          licenseCountry: body.customer.licenseCountry || "GR",
          idDocumentNo: body.customer.idDocumentNo || null,
          organizationId: orgId,
        },
      });
      customerId = created.id;
    } else {
      const existing = await prisma.customer.findFirst({
        where: { id: customerId, organizationId: orgId },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Πελάτης δεν βρέθηκε" },
          { status: 404 }
        );
      }
      if (!licenseCategoriesForCheck) {
        licenseCategoriesForCheck = existing.licenseCategories || "";
      }
    }

    if (licenseCategoriesForCheck) {
      const licenseCheck = checkLicenseForVehicleType({
        vehicleType: vehicle.vehicleType,
        licenseCategories: licenseCategoriesForCheck,
        pickupAt,
        vehicleTransmission: vehicle.category?.transmission,
        requireCategories: true,
      });
      if (!licenseCheck.ok) {
        return NextResponse.json(
          { error: licenseCheck.message, reason: licenseCheck.reason },
          { status: 400 }
        );
      }
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, vatCategory: true },
    });

    const vehicleRates = resolveVehicleRates(vehicle);
    const dailyRate = body.dailyRate ?? vehicleRates.dailyRate;
    const depositAmount = body.depositAmount ?? vehicleRates.depositAmount;

    const selectedExtras = body.extraIds?.length
      ? await prisma.extra.findMany({
          where: {
            id: { in: body.extraIds },
            organizationId: orgId,
            active: true,
          },
        })
      : [];

    const rules = await loadOrgPriceRules(orgId, vehicle.categoryId);
    const daysPreview = rentalDays(pickupAt, returnAt);
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
      pickupAt,
      returnAt,
      depositAmount,
      extrasTotal,
      vatCategory: org?.vatCategory ?? 1,
      rules,
      categoryId: vehicle.categoryId,
    });

    const pickupBranchId =
      body.pickupBranchId || vehicle.branchId || undefined;
    const returnBranchId =
      body.returnBranchId || pickupBranchId || undefined;

    const booking = await prisma.booking.create({
      data: {
        code: makeBookingCode(org?.name || "RF"),
        channel: "DESK",
        status: "CONFIRMED",
        pickupAt,
        returnAt,
        pickupPlace: vehicle.branch?.name,
        returnPlace: vehicle.branch?.name,
        dailyRate: priced.averageDaily || dailyRate,
        days: priced.days,
        extrasTotal: priced.extrasTotal,
        subtotal: priced.subtotal,
        vatAmount: priced.vatAmount,
        totalAmount: priced.totalAmount,
        depositAmount: priced.depositAmount,
        paymentStatus: body.paymentStatus || "UNPAID",
        coveragesJson: JSON.stringify(body.coverages || ["CDW"]),
        notes: body.notes,
        customerId: customerId!,
        vehicleId: vehicle.id,
        pickupBranchId,
        returnBranchId,
        organizationId: orgId,
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
      include: { customer: true, vehicle: true },
    });

    if (body.licenseFrontImage) {
      try {
        const pdf = await buildLicenseScanPdf({
          frontImageDataUrl: body.licenseFrontImage,
          backImageDataUrl: body.licenseBackImage,
          bookingCode: booking.code,
          customerName: `${booking.customer.firstName} ${booking.customer.lastName}`,
        });
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            licenseScanPdf: new Uint8Array(pdf),
            licenseScanCreatedAt: new Date(),
          },
        });
      } catch (e) {
        console.error("license scan pdf desk", e);
      }
    }

    await ensureAgreement(booking.id);
    void sendBookingConfirmationEmail(booking.id);

    return NextResponse.json({ ok: true, booking });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Μη έγκυρα στοιχεία", details: e.flatten() },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Αποτυχία δημιουργίας" }, { status: 400 });
  }
}
