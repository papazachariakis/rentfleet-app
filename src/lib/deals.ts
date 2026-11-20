import { prisma } from "@/lib/prisma";

export type DealDiscountType = "OVERRIDE_DAILY" | "PERCENT" | "FREE_DAYS";

export type DealLike = {
  id?: string;
  badge?: string | null;
  title: string;
  body?: string | null;
  cta?: string | null;
  priceLabel?: string | null;
  discountType: string;
  dealValue: number;
  paidDays?: number | null;
  active?: boolean;
  validFrom?: Date | string | null;
  validTo?: Date | string | null;
  minDays?: number | null;
  imageUrl?: string | null;
  categoryId?: string | null;
  sortOrder?: number | null;
};

export type PublicDeal = {
  id: string;
  badge: string;
  title: string;
  body: string;
  cta: string;
  priceLabel: string;
  discountType: DealDiscountType;
  dealValue: number;
  paidDays: number | null;
  dealDailyRate: number | null;
  categoryId: string | null;
  minDays: number | null;
  imageUrl: string | null;
};

export type DealPricingResult = {
  dailyRate: number;
  discountAmount: number;
  freeDays: number;
  deal: DealLike | null;
};

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function normalizeDiscountType(raw: string | null | undefined): DealDiscountType {
  if (raw === "PERCENT") return "PERCENT";
  if (raw === "OVERRIDE_DAILY") return "OVERRIDE_DAILY";
  return "FREE_DAYS";
}

/** Για 5+1: paidDays=5, freeDays=1 → ισχύει από 6 ημέρες */
export function dealThresholdDays(deal: DealLike): number | null {
  if (deal.minDays != null && deal.minDays > 0) return deal.minDays;
  const type = normalizeDiscountType(deal.discountType);
  if (type === "FREE_DAYS") {
    const paid = Math.max(1, Math.floor(Number(deal.paidDays) || 0));
    const free = Math.max(1, Math.floor(Number(deal.dealValue) || 0));
    if (paid > 0 && free > 0) return paid + free;
  }
  return null;
}

export function freeDaysFromDeal(deal: DealLike, rentalDays: number): number {
  if (normalizeDiscountType(deal.discountType) !== "FREE_DAYS") return 0;
  const paid = Math.max(1, Math.floor(Number(deal.paidDays) || 0));
  const free = Math.max(1, Math.floor(Number(deal.dealValue) || 0));
  if (paid <= 0 || free <= 0 || rentalDays <= 0) return 0;
  const bundle = paid + free;
  const threshold = dealThresholdDays(deal) ?? bundle;
  if (rentalDays < threshold) return 0;
  return Math.floor(rentalDays / bundle) * free;
}

export function dealIsActiveOn(
  deal: DealLike,
  at: Date = new Date(),
  days?: number
): boolean {
  if (deal.active === false) return false;
  const from = asDate(deal.validFrom);
  const to = asDate(deal.validTo);
  const day = dayStart(at);
  if (from && day < dayStart(from)) return false;
  if (to && day > dayStart(to)) return false;

  if (days != null) {
    const threshold = dealThresholdDays(deal);
    if (threshold != null && days < threshold) return false;
  }
  return true;
}

export function dealAppliesToCategory(deal: DealLike, categoryId: string) {
  return !deal.categoryId || deal.categoryId === categoryId;
}

export function applyDealToDailyRate(
  retailDaily: number,
  deal: DealLike
): number {
  const type = normalizeDiscountType(deal.discountType);
  if (type === "FREE_DAYS") return retailDaily;

  const value = Number(deal.dealValue);
  if (!Number.isFinite(value) || value <= 0) return retailDaily;

  if (type === "PERCENT") {
    const pct = Math.min(100, value);
    return Math.round(retailDaily * (1 - pct / 100) * 100) / 100;
  }

  return Math.round(value * 100) / 100;
}

/** Συνολικό κόστος ενοικίου μετά το deal (χωρίς extras/ΦΠΑ split) */
export function dealRentalCost(input: {
  retailDaily: number;
  days: number;
  deal: DealLike;
}): { dailyRate: number; discountAmount: number; freeDays: number; total: number } {
  const dailyRate = applyDealToDailyRate(input.retailDaily, input.deal);
  const freeDays = freeDaysFromDeal(input.deal, input.days);
  const discountAmount =
    Math.round(dailyRate * freeDays * 100) / 100;
  const total = Math.max(
    0,
    Math.round((dailyRate * input.days - discountAmount) * 100) / 100
  );
  return { dailyRate, discountAmount, freeDays, total };
}

export function findBestDeal(input: {
  deals: DealLike[];
  categoryId: string;
  retailDaily: number;
  at?: Date;
  days: number;
}): DealLike | null {
  const at = input.at ?? new Date();
  const baseTotal = Math.round(input.retailDaily * input.days * 100) / 100;
  let best: DealLike | null = null;
  let bestTotal = baseTotal;

  for (const deal of input.deals) {
    if (!dealIsActiveOn(deal, at, input.days)) continue;
    if (!dealAppliesToCategory(deal, input.categoryId)) continue;
    const { total } = dealRentalCost({
      retailDaily: input.retailDaily,
      days: input.days,
      deal,
    });
    if (total < bestTotal - 0.001 || (total <= bestTotal && !best)) {
      best = deal;
      bestTotal = total;
    }
  }

  return best;
}

export function resolveDealPricing(input: {
  retailDaily: number;
  depositAmount: number;
  categoryId: string;
  deals: DealLike[];
  days: number;
  at?: Date;
  /** Partner/broker — χωρίς public deals */
  skipDeals?: boolean;
}): DealPricingResult & { depositAmount: number } {
  if (input.skipDeals || input.days <= 0) {
    return {
      dailyRate: input.retailDaily,
      depositAmount: input.depositAmount,
      discountAmount: 0,
      freeDays: 0,
      deal: null,
    };
  }

  const deal = findBestDeal({
    deals: input.deals,
    categoryId: input.categoryId,
    retailDaily: input.retailDaily,
    at: input.at,
    days: input.days,
  });

  if (!deal) {
    return {
      dailyRate: input.retailDaily,
      depositAmount: input.depositAmount,
      discountAmount: 0,
      freeDays: 0,
      deal: null,
    };
  }

  const priced = dealRentalCost({
    retailDaily: input.retailDaily,
    days: input.days,
    deal,
  });

  return {
    dailyRate: priced.dailyRate,
    depositAmount: input.depositAmount,
    discountAmount: priced.discountAmount,
    freeDays: priced.freeDays,
    deal,
  };
}

/** @deprecated use resolveDealPricing */
export function resolveDealRates(input: {
  retailDaily: number;
  depositAmount: number;
  categoryId: string;
  deals: DealLike[];
  at?: Date;
  days?: number;
  skipDeals?: boolean;
}) {
  return resolveDealPricing({
    ...input,
    days: input.days ?? 1,
  });
}

export function dealPriceLabel(deal: DealLike): string {
  if (deal.priceLabel?.trim()) return deal.priceLabel.trim();
  const type = normalizeDiscountType(deal.discountType);
  if (type === "FREE_DAYS") {
    const paid = Math.max(1, Math.floor(Number(deal.paidDays) || 0));
    const free = Math.max(1, Math.floor(Number(deal.dealValue) || 0));
    return `${paid}+${free} δωρεάν`;
  }
  if (type === "PERCENT") return `-${deal.dealValue}%`;
  return `€${deal.dealValue}/ημέρα`;
}

export function toPublicDeal(
  deal: DealLike,
  retailDaily?: number | null
): PublicDeal {
  const discountType = normalizeDiscountType(deal.discountType);
  const dealDailyRate =
    discountType === "FREE_DAYS"
      ? null
      : retailDaily != null && Number.isFinite(retailDaily)
        ? applyDealToDailyRate(retailDaily, deal)
        : discountType === "OVERRIDE_DAILY"
          ? deal.dealValue
          : null;

  return {
    id: deal.id || "",
    badge: (deal.badge || "Προσφορά").trim() || "Προσφορά",
    title: deal.title.trim(),
    body: (deal.body || "").trim(),
    cta: (deal.cta || "Κλείσε τώρα").trim() || "Κλείσε τώρα",
    priceLabel: dealPriceLabel(deal),
    discountType,
    dealValue: deal.dealValue,
    paidDays: deal.paidDays ?? null,
    dealDailyRate,
    categoryId: deal.categoryId || null,
    minDays: dealThresholdDays(deal),
    imageUrl: deal.imageUrl || null,
  };
}

export function toPublicDeals(
  deals: DealLike[],
  categories?: { id: string; baseDailyRate: number }[],
  at: Date = new Date()
): PublicDeal[] {
  const byId = new Map((categories || []).map((c) => [c.id, c.baseDailyRate]));
  return deals
    .filter((d) => dealIsActiveOn(d, at))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((d) => {
      const retail = d.categoryId ? byId.get(d.categoryId) : undefined;
      return toPublicDeal(d, retail ?? null);
    })
    .filter((d) => Boolean(d.title));
}

export async function loadOrgDeals(organizationId: string) {
  return prisma.deal.findMany({
    where: { organizationId, active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

/**
 * Μετά το priceRental: αν το deal είναι FREE_DAYS, η έκπτωση βασίζεται
 * στο averageDaily (ώστε να μετράνε και οι κανόνες περιόδου).
 */
export function finalizeDealDiscount(input: {
  averageDaily: number;
  days: number;
  deal: DealLike | null;
  /** Ήδη εφαρμοσμένη αλλαγή ημερήσιας (OVERRIDE/PERCENT) */
  preDiscountAmount?: number;
}) {
  if (!input.deal) {
    return {
      discountAmount: input.preDiscountAmount || 0,
      freeDays: 0,
    };
  }
  const freeDays = freeDaysFromDeal(input.deal, input.days);
  if (freeDays <= 0) {
    return {
      discountAmount: input.preDiscountAmount || 0,
      freeDays: 0,
    };
  }
  const freeDiscount =
    Math.round(input.averageDaily * freeDays * 100) / 100;
  return {
    discountAmount:
      Math.round(((input.preDiscountAmount || 0) + freeDiscount) * 100) / 100,
    freeDays,
  };
}
