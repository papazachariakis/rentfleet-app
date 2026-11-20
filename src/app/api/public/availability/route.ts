import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findAvailableVehicles } from "@/lib/public-booking";
import { loadOrgPriceRules, priceRental } from "@/lib/bookings";
import { calcExtrasTotal, resolvePartnerRates } from "@/lib/pricing";
import {
  dealPriceLabel,
  finalizeDealDiscount,
  loadOrgDeals,
  resolveDealPricing,
} from "@/lib/deals";
import { rentalDays } from "@/lib/utils";
import { loadPartnerByPublicToken } from "@/lib/partners";
import { publicOptions, withPublicCors } from "@/lib/public-cors";

export async function OPTIONS(req: Request) {
  return publicOptions(req);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const partnerToken = url.searchParams.get("partnerToken") || "";
  const categoryId = url.searchParams.get("categoryId") || "";
  const pickupAtRaw = url.searchParams.get("pickupAt") || "";
  const returnAtRaw = url.searchParams.get("returnAt") || "";
  const branchId = url.searchParams.get("branchId");
  const extraIds = (url.searchParams.get("extraIds") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!token || !categoryId || !pickupAtRaw || !returnAtRaw) {
    return withPublicCors(
      req,
      NextResponse.json({ error: "Λείπουν παράμετροι" }, { status: 400 })
    );
  }

  const org = await prisma.organization.findUnique({
    where: { publicToken: token },
    select: { id: true, vatCategory: true },
  });
  if (!org) {
    return withPublicCors(
      req,
      NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 })
    );
  }

  const partner = partnerToken
    ? await loadPartnerByPublicToken(partnerToken)
    : null;
  if (partnerToken && (!partner || partner.organizationId !== org.id)) {
    return withPublicCors(
      req,
      NextResponse.json({ error: "Μη έγκυρη συμφωνία partner" }, { status: 400 })
    );
  }

  const pickupAt = new Date(pickupAtRaw);
  const returnAt = new Date(returnAtRaw);
  if (Number.isNaN(pickupAt.getTime()) || Number.isNaN(returnAt.getTime())) {
    return withPublicCors(
      req,
      NextResponse.json({ error: "Μη έγκυρες ημερομηνίες" }, { status: 400 })
    );
  }
  if (!(returnAt > pickupAt)) {
    return withPublicCors(
      req,
      NextResponse.json(
        {
          error:
            "Η ημερομηνία και ώρα επιστροφής πρέπει να είναι μεταγενέστερη της παραλαβής",
        },
        { status: 400 }
      )
    );
  }

  const category = await prisma.vehicleCategory.findFirst({
    where: { id: categoryId, organizationId: org.id, active: true },
  });
  if (!category) {
    return withPublicCors(
      req,
      NextResponse.json({ error: "Κατηγορία δεν βρέθηκε" }, { status: 404 })
    );
  }

  const vehicles = await findAvailableVehicles({
    organizationId: org.id,
    categoryId,
    pickupAt,
    returnAt,
    preferredBranchId: branchId,
  });

  const rules = await loadOrgPriceRules(org.id, categoryId);
  const extras = extraIds.length
    ? await prisma.extra.findMany({
        where: { id: { in: extraIds }, organizationId: org.id, active: true },
      })
    : [];
  const daysPreview = rentalDays(pickupAt, returnAt);
  const extrasTotal = calcExtrasTotal(
    extras.map((e) => ({
      dailyRate: e.dailyRate,
      flatRate: e.flatRate,
      quantity: 1,
    })),
    daysPreview
  );

  const partnerRates = partner
    ? resolvePartnerRates(
        {
          categoryId: category.id,
          category: {
            id: category.id,
            baseDailyRate: category.baseDailyRate,
            depositAmount: category.depositAmount,
          },
        },
        partner
      )
    : {
        dailyRate: category.baseDailyRate,
        depositAmount: category.depositAmount,
      };

  const deals = partner ? [] : await loadOrgDeals(org.id);
  const dealPricing = resolveDealPricing({
    retailDaily: partnerRates.dailyRate,
    depositAmount: partnerRates.depositAmount,
    categoryId,
    deals,
    days: daysPreview,
    at: pickupAt,
    skipDeals: Boolean(partner),
  });

  const pricedBase = priceRental({
    dailyRate: dealPricing.dailyRate,
    pickupAt,
    returnAt,
    depositAmount: dealPricing.depositAmount,
    vatCategory: org.vatCategory,
    rules,
    categoryId,
    extrasTotal,
  });
  const { discountAmount, freeDays } = finalizeDealDiscount({
    averageDaily: pricedBase.averageDaily || dealPricing.dailyRate,
    days: pricedBase.days,
    deal: dealPricing.deal,
  });
  const priced =
    discountAmount > 0
      ? priceRental({
          dailyRate: dealPricing.dailyRate,
          pickupAt,
          returnAt,
          depositAmount: dealPricing.depositAmount,
          vatCategory: org.vatCategory,
          rules,
          categoryId,
          extrasTotal,
          discountAmount,
        })
      : pricedBase;

  // Public clients must not see plate numbers — only desk/admin does.
  const list = vehicles.map((v) => ({
    id: v.id,
    make: v.make,
    model: v.model,
    year: v.year,
    branchName: v.branch?.name || null,
    imageUrl: v.photos?.[0] || null,
  }));

  return withPublicCors(
    req,
    NextResponse.json({
      available: list.length > 0,
      count: list.length,
      vehicles: list,
      /** συμβατότητα με παλιό UI */
      vehicle: list[0] || null,
      quote: {
        ...priced,
        discountAmount,
        retailDailyRate: partnerRates.dailyRate,
        dealDailyRate: dealPricing.dailyRate,
        deal: dealPricing.deal
          ? {
              id: dealPricing.deal.id,
              title: dealPricing.deal.title,
              badge: dealPricing.deal.badge || "Προσφορά",
              priceLabel: dealPriceLabel(dealPricing.deal),
              freeDays,
              discountType: dealPricing.deal.discountType,
            }
          : null,
      },
    })
  );
}
