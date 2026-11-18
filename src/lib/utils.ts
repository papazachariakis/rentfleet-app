import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

const ATHENS_TZ = "Europe/Athens";

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("el-GR", {
    timeZone: ATHENS_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string) {
  return new Intl.DateTimeFormat("el-GR", {
    timeZone: ATHENS_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/** Ώρες χάριτος μετά τις πρώτες 24ώρες κάθε ημερήσιας περιόδου (κλασικό rent-a-car). */
export const RENTAL_GRACE_HOURS = 3;

/**
 * Ημέρες ενοικίασης (ελάχιστο 1).
 * 1 ημέρα = 24 ώρες · επιπλέον έως 3 ώρες χωρίς χρέωση · πάνω από 27 ώρες → +1 ημέρα.
 * Γενικά: max(1, ceil((ώρες − 3) / 24)).
 */
export function rentalDays(pickupAt: Date | string, returnAt: Date | string) {
  const ms = new Date(returnAt).getTime() - new Date(pickupAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 1;
  const hours = ms / (1000 * 60 * 60);
  return Math.max(1, Math.ceil((hours - RENTAL_GRACE_HOURS) / 24));
}

/** Επιστροφή πρέπει να είναι αυστηρά μετά την παραλαβή. */
export function isReturnAfterPickup(
  pickupAt: Date | string,
  returnAt: Date | string
) {
  const p = new Date(pickupAt).getTime();
  const r = new Date(returnAt).getTime();
  return !Number.isNaN(p) && !Number.isNaN(r) && r > p;
}

export const RETURN_AFTER_PICKUP_MSG =
  "Η ημερομηνία και ώρα επιστροφής πρέπει να είναι μεταγενέστερη της παραλαβής";

/** datetime-local value από Date */
export function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Επιστροφή = ίδια ημέρα με παραλαβή, +1 ώρα. */
export function returnOneHourAfterPickup(pickupAt: string) {
  const next = new Date(pickupAt);
  if (Number.isNaN(next.getTime())) return pickupAt;
  next.setHours(next.getHours() + 1);
  return toLocalInput(next);
}

/** Αν η επιστροφή ≤ παραλαβή, ορίζει επιστροφή = παραλαβή +1 ώρα. */
export function ensureReturnAfterPickup(pickupAt: string, returnAt: string) {
  if (isReturnAfterPickup(pickupAt, returnAt)) return returnAt;
  return returnOneHourAfterPickup(pickupAt);
}

export function vehicleTypeLabel(type: string) {
  const map: Record<string, string> = {
    CAR: "Αυτοκίνητο",
    MOTO: "Μοτοσυκλέτα",
    SCOOTER: "Σκούτερ",
    VAN: "Van",
  };
  return map[type] || type;
}

/**
 * Ταξινόμηση κατηγοριών τύπου CAT A, CAT.B, CAT. D1… (όχι απλό αλφαβητικό string).
 * Παράδειγμα σειράς: CAT.A → CAT.B → CAT.C → CAT.D → CAT.D+ → CAT.D1 → CAT.E → …
 */
export function categorySortKey(name: string): {
  isCat: boolean;
  letter: string;
  num: number;
  plus: number;
  rest: string;
  raw: string;
} {
  const raw = (name || "").trim();
  const normalized = raw
    .toUpperCase()
    .replace(/[./_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const m = normalized.match(/^CAT\s*([A-Z])\s*(\d+)?\s*(\+)?\s*(.*)$/);
  if (m) {
    return {
      isCat: true,
      letter: m[1],
      num: m[2] ? Number(m[2]) : 0,
      plus: m[3] ? 1 : 0,
      rest: (m[4] || "").trim(),
      raw: normalized,
    };
  }
  return {
    isCat: false,
    letter: "",
    num: 0,
    plus: 0,
    rest: normalized,
    raw: normalized,
  };
}

export function compareCategoryNames(a: string, b: string) {
  const ka = categorySortKey(a);
  const kb = categorySortKey(b);
  if (ka.isCat !== kb.isCat) return ka.isCat ? -1 : 1;
  if (ka.isCat && kb.isCat) {
    if (ka.letter !== kb.letter) return ka.letter.localeCompare(kb.letter);
    if (ka.num !== kb.num) return ka.num - kb.num;
    if (ka.plus !== kb.plus) return ka.plus - kb.plus;
    if (ka.rest !== kb.rest) {
      return ka.rest.localeCompare(kb.rest, "el", {
        numeric: true,
        sensitivity: "base",
      });
    }
  }
  return ka.raw.localeCompare(kb.raw, "el", {
    numeric: true,
    sensitivity: "base",
  });
}

export function sortByCategoryName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => compareCategoryNames(a.name, b.name));
}
