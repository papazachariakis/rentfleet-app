export type ParsedLicenseCategory = {
  code: string;
  expiry?: string; // YYYY-MM-DD
  /** Κωδικοί στήλης 12, π.χ. ["78","121"] */
  codes?: string[];
  automaticOnly?: boolean;
};

/** Ιεραρχία: αν έχεις ανώτερη, καλύπτεις και τις κατώτερες. */
export const LICENSE_IMPLIES: Record<string, string[]> = {
  A: ["A", "A2", "A1", "AM"],
  A2: ["A2", "A1", "AM"],
  A1: ["A1", "AM"],
  AM: ["AM"],
  B: ["B", "B1"],
  B1: ["B1"],
  BE: ["BE", "B", "B1"],
  C: ["C", "C1"],
  C1: ["C1"],
  CE: ["CE", "C1E"],
  C1E: ["C1E"],
  D: ["D", "D1"],
  D1: ["D1"],
  DE: ["DE", "D1E"],
  D1E: ["D1E"],
};

/** Ποια δίπλωμα-κατηγορία καλύπτει κάθε τύπο οχήματος RentFleet. */
export const VEHICLE_TYPE_LICENSE_CODES: Record<string, string[]> = {
  CAR: ["B", "BE", "B1", "C1", "C", "C1E", "CE", "D1", "D", "D1E", "DE"],
  VAN: ["B", "BE", "C1", "C", "C1E", "CE"],
  MOTO: ["A", "A2", "A1"],
  SCOOTER: ["AM", "A1", "A2", "A"],
};

export function requiredLicenseCodesForVehicleType(vehicleType: string) {
  return (
    VEHICLE_TYPE_LICENSE_CODES[vehicleType] || VEHICLE_TYPE_LICENSE_CODES.CAR
  );
}

function normalizeDate(value?: string) {
  if (!value) return undefined;
  const v = value.trim().replace(/\s+/g, "");
  // DD.MM.YY ή DD.MM.YYYY — τελευταίο ζεύγος = έτος
  const m = v.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    let y = Number(m[3]);
    if (y >= 0 && y <= 99) y += 2000;
    if (y < 1990 || y > 2065) return undefined;
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return undefined;
    return `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return undefined;
}

function parseCodes(raw?: string | string[] | null): string[] {
  if (!raw) return [];
  const list = Array.isArray(raw)
    ? raw
    : String(raw).split(/[,;+\s]+/);
  return [
    ...new Set(
      list
        .map((c) => String(c).replace(/\D/g, ""))
        .filter((c) => c.length > 0)
    ),
  ];
}

/** Parse "B (λήξη 2030-01-15 · 78,121), AM" ή JSON array. */
export function parseLicenseCategories(
  raw?: string | null
): ParsedLicenseCategory[] {
  if (!raw?.trim()) return [];
  const text = raw.trim();

  if (text.startsWith("[")) {
    try {
      const arr = JSON.parse(text) as Array<{
        code?: string;
        expiry?: string;
        codes?: string[];
        automaticOnly?: boolean;
      }>;
      return arr
        .map((x) => {
          const code = String(x.code || "")
            .toUpperCase()
            .replace(/\s+/g, "");
          const codes = parseCodes(x.codes);
          return {
            code,
            expiry: x.expiry || undefined,
            codes,
            automaticOnly:
              Boolean(x.automaticOnly) || codes.includes("78"),
          };
        })
        .filter((x) => /^[A-Z0-9]{1,4}$/.test(x.code));
    } catch {
      /* fall through */
    }
  }

  const parts = text.split(/[,;|/]+/).map((p) => p.trim()).filter(Boolean);
  const out: ParsedLicenseCategory[] = [];
  for (const part of parts) {
    const m = part.match(
      /^([A-Za-z0-9]{1,4})(?:\s*\(([^)]*)\))?/i
    );
    if (!m) continue;
    const code = m[1].toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z0-9]{1,4}$/.test(code)) continue;
    const inside = m[2] || "";
    const dateMatch = inside.match(
      /(\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/
    );
    const codeMatch = inside.match(
      /(?:κωδ\.?|codes?|·)?\s*([\d,\s]+)/i
    );
    const codes = parseCodes(
      codeMatch?.[1] ||
        inside.match(/\b(\d{2,3}(?:\s*,\s*\d{2,3})*)\b/)?.[1]
    );
    out.push({
      code,
      expiry: normalizeDate(dateMatch?.[1]),
      codes,
      automaticOnly: codes.includes("78"),
    });
  }
  return out;
}

export function formatLicenseCategoriesSummary(
  details: ParsedLicenseCategory[]
) {
  if (!details.length) return "";
  return details
    .map((d) => {
      const bits: string[] = [];
      if (d.expiry) bits.push(`λήξη ${d.expiry}`);
      if (d.codes?.length) bits.push(`κωδ. ${d.codes.join(",")}`);
      return bits.length ? `${d.code} (${bits.join(" · ")})` : d.code;
    })
    .join(", ");
}

function dayStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function isLicenseCategoryValidOn(
  cat: ParsedLicenseCategory,
  onDate: Date
) {
  if (!cat.expiry) return true;
  const exp = new Date(cat.expiry);
  if (Number.isNaN(exp.getTime())) return true;
  return dayStart(exp) >= dayStart(onDate);
}

/**
 * Αποτελεσματικές κατηγορίες από μία γραμμή διπλώματος
 * (ιεραρχία + κωδικός 121 στο Β → A1, AM).
 */
export function expandEffectiveCodes(cat: ParsedLicenseCategory): string[] {
  const base = LICENSE_IMPLIES[cat.code] || [cat.code];
  const set = new Set(base);
  const codes = cat.codes || [];
  if (cat.code === "B" && codes.includes("121")) {
    set.add("A1");
    set.add("AM");
  }
  return [...set];
}

function isManualTransmission(transmission?: string | null) {
  if (!transmission) return false;
  const t = transmission.toUpperCase();
  return (
    t.includes("MANUAL") ||
    t.includes("ΧΕΙΡ") ||
    t === "MT" ||
    t.includes("MAN")
  );
}

function isAutomaticTransmission(transmission?: string | null) {
  if (!transmission) return false;
  const t = transmission.toUpperCase();
  return (
    t.includes("AUTO") ||
    t.includes("ΑΥΤΟΜ") ||
    t === "AT" ||
    t.includes("AUT")
  );
}

export type LicenseVehicleCheck =
  | {
      ok: true;
      matched: ParsedLicenseCategory;
      effectiveCode: string;
    }
  | {
      ok: false;
      reason:
        | "MISSING_CATEGORIES"
        | "NO_MATCHING_CATEGORY"
        | "EXPIRED"
        | "AUTOMATIC_ONLY";
      message: string;
      required: string[];
      found?: ParsedLicenseCategory[];
    };

/**
 * Ελέγχει αν το δίπλωμα επιτρέπει ενοικίαση του vehicleType στην ημερομηνία παραλαβής.
 * - Ιεραρχία A>A2>A1>AM, B>B1, C>C1, D>D1, CE>C1E, DE>D1E
 * - Κωδ. 121 στη γραμμή B → επιπλέον A1+AM
 * - Κωδ. 78 → μόνο αυτόματο κιβώτιο
 */
export function checkLicenseForVehicleType(input: {
  vehicleType: string;
  licenseCategories?: string | null;
  pickupAt: Date;
  vehicleTransmission?: string | null;
  requireCategories?: boolean;
}): LicenseVehicleCheck {
  const required = requiredLicenseCodesForVehicleType(input.vehicleType);
  const found = parseLicenseCategories(input.licenseCategories);

  if (!found.length) {
    if (input.requireCategories) {
      return {
        ok: false,
        reason: "MISSING_CATEGORIES",
        message:
          "Απαιτούνται κατηγορίες διπλώματος (πίσω όψη) για αυτή την κράτηση",
        required,
      };
    }
    return {
      ok: true,
      matched: { code: required[0] },
      effectiveCode: required[0],
    };
  }

  type Hit = {
    source: ParsedLicenseCategory;
    effectiveCode: string;
  };
  const hits: Hit[] = [];
  for (const cat of found) {
    const effective = expandEffectiveCodes(cat);
    for (const code of effective) {
      if (required.includes(code)) {
        hits.push({ source: cat, effectiveCode: code });
      }
    }
  }

  if (!hits.length) {
    return {
      ok: false,
      reason: "NO_MATCHING_CATEGORY",
      message: `Το δίπλωμα δεν καλύπτει ${vehicleTypeLabelEl(input.vehicleType)} (απαιτείται μία από: ${required.join(", ")})`,
      required,
      found,
    };
  }

  const validHits = hits.filter((h) =>
    isLicenseCategoryValidOn(h.source, input.pickupAt)
  );
  if (!validHits.length) {
    const expired = hits
      .map(
        (h) =>
          `${h.source.code}${
            h.source.expiry ? ` (λήξη ${h.source.expiry})` : ""
          }`
      )
      .join(", ");
    return {
      ok: false,
      reason: "EXPIRED",
      message: `Η κατηγορία διπλώματος για αυτό το όχημα έχει λήξει: ${expired}`,
      required,
      found,
    };
  }

  // Προτίμησε hit χωρίς 78 αν το όχημα είναι χειροκίνητο
  const manualVehicle = isManualTransmission(input.vehicleTransmission);
  const autoVehicle = isAutomaticTransmission(input.vehicleTransmission);

  const usable = validHits.filter((h) => {
    const autoOnly =
      h.source.automaticOnly || h.source.codes?.includes("78");
    if (autoOnly && manualVehicle) return false;
    return true;
  });

  if (!usable.length) {
    return {
      ok: false,
      reason: "AUTOMATIC_ONLY",
      message:
        "Το δίπλωμα έχει κωδικό 78 (μόνο αυτόματο) — δεν επιτρέπεται ενοικίαση χειροκίνητου οχήματος",
      required,
      found,
    };
  }

  // Αν δεν ξέρουμε transmission, επέτρεψε· αν είναι auto, 78 είναι OK
  void autoVehicle;
  const best = usable[0];
  return {
    ok: true,
    matched: best.source,
    effectiveCode: best.effectiveCode,
  };
}

function vehicleTypeLabelEl(type: string) {
  const map: Record<string, string> = {
    CAR: "αυτοκίνητο",
    VAN: "van",
    MOTO: "μοτοσυκλέτα",
    SCOOTER: "σκούτερ",
  };
  return map[type] || type;
}
