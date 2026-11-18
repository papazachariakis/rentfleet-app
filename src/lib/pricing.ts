import { rentalDays } from "@/lib/utils";

/** Τιμή/εγγύηση οχήματος: προτεραιότητα στο όχημα, αλλιώς κατηγορία. */
export function resolveVehicleRates(vehicle: {
  dailyRate?: number | null;
  depositAmount?: number | null;
  category?: {
    baseDailyRate?: number | null;
    depositAmount?: number | null;
  } | null;
}) {
  return {
    dailyRate: vehicle.dailyRate ?? vehicle.category?.baseDailyRate ?? 40,
    depositAmount:
      vehicle.depositAmount ?? vehicle.category?.depositAmount ?? 300,
  };
}

export type PriceRuleLike = {
  startDate: Date;
  endDate: Date;
  multiplier: number;
  minDailyRate?: number | null;
  weekendOnly?: boolean;
  categoryId?: string | null;
  active?: boolean;
};

function dayStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isWeekend(d: Date) {
  const day = d.getDay();
  return day === 0 || day === 6;
}

/** Ημερήσια τιμή με κανόνες περιόδου / ΣΚ */
export function dailyPrice(
  baseDailyRate: number,
  day: Date,
  rules: PriceRuleLike[],
  categoryId?: string | null
) {
  const t = dayStart(day).getTime();
  const active = rules.filter((r) => {
    if (r.active === false) return false;
    if (r.categoryId && categoryId && r.categoryId !== categoryId) return false;
    if (r.categoryId && !categoryId) return false;
    if (r.weekendOnly && !isWeekend(day)) return false;
    const a = dayStart(r.startDate).getTime();
    const b = dayStart(r.endDate).getTime();
    return t >= a && t <= b;
  });

  if (!active.length) return Math.round(baseDailyRate * 100) / 100;

  let best = baseDailyRate;
  for (const r of active) {
    const fromMult = baseDailyRate * r.multiplier;
    const candidate = Math.max(fromMult, r.minDailyRate ?? 0);
    if (candidate > best) best = candidate;
  }
  return Math.round(best * 100) / 100;
}

/** Άθροισμα ημερήσιων τιμών για pickup→return */
export function rentalSubtotalWithRules(
  baseDailyRate: number,
  pickupAt: Date,
  returnAt: Date,
  rules: PriceRuleLike[],
  categoryId?: string | null
) {
  const days = rentalDays(pickupAt, returnAt);
  let total = 0;
  const cur = dayStart(pickupAt);
  for (let i = 0; i < days; i++) {
    total += dailyPrice(baseDailyRate, cur, rules, categoryId);
    cur.setDate(cur.getDate() + 1);
  }
  return {
    days,
    rentalGross: Math.round(total * 100) / 100,
    averageDaily: Math.round((total / Math.max(1, days)) * 100) / 100,
  };
}

export function calcExtrasTotal(
  items: { dailyRate: number; flatRate?: number | null; quantity: number }[],
  days: number
) {
  let total = 0;
  for (const item of items) {
    const unit =
      item.flatRate != null && item.flatRate > 0
        ? item.flatRate
        : item.dailyRate * days;
    total += unit * item.quantity;
  }
  return Math.round(total * 100) / 100;
}
