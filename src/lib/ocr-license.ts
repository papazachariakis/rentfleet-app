import { formatLicenseCategoriesSummary } from "@/lib/license-categories";

export type LicenseCategoryDetail = {
  code: string;
  issued?: string;
  expiry?: string;
  /** Κωδικοί στήλης 12 (π.χ. 78, 121) */
  codes?: string[];
};

export type LicenseOcrResult = {
  firstName?: string;
  lastName?: string;
  licenseNumber?: string;
  licenseCountry?: string;
  idDocumentNo?: string;
  afm?: string;
  licenseCategories?: string;
  licenseCategoryDetails?: LicenseCategoryDetail[];
  dateOfBirth?: string;
  licenseExpiry?: string;
  rawText?: string;
  confidence?: "high" | "medium" | "low";
};

type RawCategory =
  | string
  | {
      code?: string;
      category?: string;
      field9?: string;
      issued?: string;
      issueDate?: string;
      field10?: string;
      field10Raw?: string;
      expiry?: string;
      expiryDate?: string;
      validUntil?: string;
      field11?: string;
      field11Raw?: string;
      codes?: string[] | string;
      restrictions?: string[] | string;
      field12?: string;
    };

type RawOcr = {
  firstName?: string;
  lastName?: string;
  firstNameLatin?: string;
  lastNameLatin?: string;
  licenseNumber?: string;
  licenseCountry?: string;
  idDocumentNo?: string;
  afm?: string;
  licenseCategories?: string;
  dateOfBirth?: string;
  licenseExpiry?: string;
  confidence?: "high" | "medium" | "low";
  field4d?: string;
  field5?: string;
  field9?: string;
  categories?: RawCategory[] | string;
  categoryDetails?: RawCategory[];
  licenseCategoryDetails?: RawCategory[];
  "4d"?: string;
  "5"?: string;
  "9"?: string;
};

const GREEK_TO_LATIN: Record<string, string> = {
  Α: "A",
  Β: "V",
  Γ: "G",
  Δ: "D",
  Ε: "E",
  Ζ: "Z",
  Η: "I",
  Θ: "TH",
  Ι: "I",
  Κ: "K",
  Λ: "L",
  Μ: "M",
  Ν: "N",
  Ξ: "X",
  Ο: "O",
  Π: "P",
  Ρ: "R",
  Σ: "S",
  ς: "S",
  Τ: "T",
  Υ: "Y",
  Φ: "F",
  Χ: "CH",
  Ψ: "PS",
  Ω: "O",
  ά: "A",
  έ: "E",
  ή: "I",
  ί: "I",
  ό: "O",
  ύ: "Y",
  ώ: "O",
  ϊ: "I",
  ϋ: "Y",
  ΐ: "I",
  ΰ: "Y",
};

function extractJson(text: string): RawOcr {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```(?:json)?\s*([\s\S]*?)```/i, "$1")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("NO_JSON");
  return JSON.parse(cleaned.slice(start, end + 1)) as RawOcr;
}

function cleanDigits(value: string) {
  return value.replace(/\D/g, "");
}

function cleanLicenseNo(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function hasGreek(s: string) {
  return /[\u0370-\u03FF\u1F00-\u1FFF]/.test(s);
}

function transliterateGreek(s: string) {
  let out = "";
  for (const ch of s.normalize("NFC")) {
    const up = ch.toUpperCase();
    if (GREEK_TO_LATIN[ch]) out += GREEK_TO_LATIN[ch];
    else if (GREEK_TO_LATIN[up]) out += GREEK_TO_LATIN[up];
    else if (/[A-Za-z0-9 '\-]/.test(ch)) out += ch;
    else if (/\s/.test(ch)) out += " ";
  }
  return out.replace(/\s+/g, " ").trim().toUpperCase();
}

/** Μόνο λατινικά ονόματα — προτίμηση Latin γραμμής, αλλιώς transliteration. */
export function latinOnlyName(...candidates: Array<string | undefined>) {
  for (const raw of candidates) {
    if (!raw?.trim()) continue;
    const s = raw.trim();
    if (!hasGreek(s)) {
      const cleaned = s.replace(/[^A-Za-z0-9 '\-]/g, " ").replace(/\s+/g, " ").trim();
      if (cleaned) return cleaned.toUpperCase();
    }
    // Μείγμα: κράτα μόνο λατινικά τμήματα
    const latinParts = s
      .split(/\s+/)
      .map((p) => p.replace(/[^A-Za-z0-9'\-]/g, ""))
      .filter((p) => p.length >= 2 && !hasGreek(p));
    if (latinParts.length) return latinParts.join(" ").toUpperCase();
  }
  for (const raw of candidates) {
    if (!raw?.trim()) continue;
    if (hasGreek(raw)) {
      const t = transliterateGreek(raw);
      if (t) return t;
    }
  }
  return undefined;
}

type DateKind = "expiry" | "issue" | "dob";

/**
 * Ελληνικές άδειες: ημερομηνίες στη μορφή DD.MM.YY (2ψήφιο έτος).
 * π.χ. 15.03.31 → 2031-03-15 (λήξη) · 12.05.85 → 1985-05-12 (γέννηση).
 */
function expandTwoDigitYear(yy: number, kind: DateKind) {
  if (yy < 0 || yy > 99) return null;
  if (kind === "dob") {
    const nowYY = new Date().getFullYear() % 100;
    // Αν το YY είναι μεγαλύτερο από «τώρα+1», είναι 19xx (π.χ. 85 → 1985)
    return yy > nowYY + 1 ? 1900 + yy : 2000 + yy;
  }
  // Έκδοση / λήξη κατηγοριών: σχεδόν πάντα 20xx
  return 2000 + yy;
}

function normalizeDate(
  value?: string,
  opts?: { kind?: DateKind; minYear?: number; maxYear?: number }
) {
  if (!value) return undefined;
  const kind = opts?.kind ?? "expiry";
  const v = value.trim().replace(/\s+/g, "");
  if (!v || /^[.—\-–]+$/.test(v)) return undefined;

  const minY =
    opts?.minYear ?? (kind === "dob" ? 1920 : 1990);
  const maxY =
    opts?.maxYear ?? (kind === "dob" ? 2015 : 2065);

  const fixYear = (yRaw: string) => {
    let y = Number(yRaw);
    if (!Number.isFinite(y)) return null;
    if (y >= 0 && y <= 99) {
      const expanded = expandTwoDigitYear(y, kind);
      if (expanded == null) return null;
      y = expanded;
    } else if (y >= 100 && y <= 999) {
      return null;
    }
    if (y < minY || y > maxY) return null;
    return y;
  };

  const asIso = (dd: number, mm: number, yyyy: number) => {
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return undefined;
    // Απόρριψη ανύπαρκτων ημερομηνιών (π.χ. 31.02)
    const probe = new Date(Date.UTC(yyyy, mm - 1, dd));
    if (
      probe.getUTCFullYear() !== yyyy ||
      probe.getUTCMonth() !== mm - 1 ||
      probe.getUTCDate() !== dd
    ) {
      return undefined;
    }
    return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  };

  // DD.MM.YY ή DD.MM.YYYY
  const eu = v.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/);
  if (eu) {
    const y = fixYear(eu[3]);
    if (y != null) {
      const iso = asIso(Number(eu[1]), Number(eu[2]), y);
      if (iso) return iso;
    }
  }

  // YYYY-MM-DD
  const isoLike = v.match(/^(\d{4})[./\-](\d{1,2})[./\-](\d{1,2})$/);
  if (isoLike) {
    const y = fixYear(isoLike[1]);
    if (y != null) {
      const iso = asIso(Number(isoLike[3]), Number(isoLike[2]), y);
      if (iso) return iso;
    }
  }

  const digits = v.replace(/\D/g, "");
  // DDMMYY
  if (digits.length === 6) {
    const d1 = Number(digits.slice(0, 2));
    const m1 = Number(digits.slice(2, 4));
    const y1 = fixYear(digits.slice(4, 6));
    if (y1 != null) {
      const iso = asIso(d1, m1, y1);
      if (iso) return iso;
    }
  }
  // DDMMYYYY
  if (digits.length === 8) {
    const d1 = Number(digits.slice(0, 2));
    const m1 = Number(digits.slice(2, 4));
    const y1 = fixYear(digits.slice(4, 8));
    if (y1 != null) {
      const iso = asIso(d1, m1, y1);
      if (iso) return iso;
    }
  }

  return undefined;
}

/**
 * OCR συχνά αντιστρέφει ημέρα↔έτος: "15.03.31" → γράφει "31.03.15".
 * Δοκιμάζει και YY.MM.DD και επιλέγει την πιο λογική λήξη/έκδοση.
 */
function normalizePrintedDate(
  value?: string,
  opts?: { kind?: DateKind; issuedIso?: string }
): string | undefined {
  if (!value) return undefined;
  const kind = opts?.kind ?? "expiry";
  const v = value.trim().replace(/\s+/g, "");
  const m = v.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2})$/);
  const primary = normalizeDate(value, { kind });
  if (!m) return primary;

  // Εναλλακτική: πρώτο ζεύγος = έτος YY, τελευταίο = ημέρα
  const altRaw = `${m[3]}.${m[2]}.${m[1]}`;
  const alternate = normalizeDate(altRaw, { kind });
  if (!alternate) return primary;
  if (!primary) return alternate;
  if (primary === alternate) return primary;

  const issuedMs = opts?.issuedIso
    ? new Date(opts.issuedIso + "T12:00:00").getTime()
    : NaN;
  const nowY = new Date().getFullYear();

  const score = (iso: string) => {
    const y = Number(iso.slice(0, 4));
    let s = 0;
    if (kind === "expiry") {
      // Λήξη κατηγορίας: συνήθως από τώρα έως +20 έτη, μετά την έκδοση
      if (y >= nowY - 1 && y <= nowY + 20) s += 5;
      if (y >= 2020 && y <= 2055) s += 2;
      if (!Number.isNaN(issuedMs)) {
        const t = new Date(iso + "T12:00:00").getTime();
        if (t >= issuedMs) s += 4;
        else s -= 6;
        const yearsAfter = (t - issuedMs) / (365.25 * 24 * 3600 * 1000);
        if (yearsAfter >= 5 && yearsAfter <= 16) s += 3;
      }
      // 201x ως «λήξη» όταν υπάρχει εναλλακτική 203x → ύποπτο
      if (y < nowY - 1) s -= 3;
    } else if (kind === "issue") {
      if (y >= 1995 && y <= nowY + 1) s += 5;
      if (y > nowY + 1) s -= 5;
    }
    return s;
  };

  return score(alternate) > score(primary) ? alternate : primary;
}

function pickBestDate(
  kind: DateKind,
  ...candidates: Array<string | undefined>
): string | undefined {
  for (const c of candidates) {
    const n = normalizeDate(c, { kind });
    if (n) return n;
  }
  return undefined;
}

/** Αν η λήξη είναι πριν την έκδοση, μάλλον μπερδεύτηκε η ημερομηνία. */
function sanitizeExpiry(issued?: string, expiry?: string) {
  if (!expiry) return undefined;
  if (!issued) return expiry;
  const a = new Date(issued + "T12:00:00").getTime();
  const b = new Date(expiry + "T12:00:00").getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return expiry;
  if (b < a) return undefined;
  return expiry;
}

function normalizeCategoryCode(code: string) {
  return code.toUpperCase().replace(/\s+/g, "");
}

function parseCodeList(raw?: string | string[] | null): string[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : String(raw).split(/[,;+\s/]+/);
  return [
    ...new Set(
      list
        .map((c) => String(c).replace(/\D/g, ""))
        .filter((c) => c.length >= 2)
    ),
  ];
}

function parseCategoryEntry(entry: RawCategory): LicenseCategoryDetail | null {
  if (typeof entry === "string") {
    const m = entry.match(
      /^([A-Za-z0-9]{1,4})\s*(?:[:→\-]|λήξη)?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2})?/i
    );
    if (!m) return null;
    const code = normalizeCategoryCode(m[1]);
    if (!/^[A-Z0-9]{1,4}$/.test(code)) return null;
    return {
      code,
      expiry: normalizeDate(m[2], { kind: "expiry" }),
      codes: [],
    };
  }

  const code = normalizeCategoryCode(
    String(entry.code || entry.category || entry.field9 || "").trim()
  );
  if (!code || !/^[A-Z0-9]{1,4}$/.test(code)) return null;

  // Προτεραιότητα στο raw DD.MM.YY από την εικόνα (όχι στο ISO που υπολογίζει το μοντέλο)
  const issued =
    normalizePrintedDate(entry.field10Raw, { kind: "issue" }) ||
    pickBestDate("issue", entry.field10, entry.issued, entry.issueDate);

  const expiryFromRaw =
    normalizePrintedDate(entry.field11Raw, {
      kind: "expiry",
      issuedIso: issued,
    }) ||
    normalizePrintedDate(entry.field11, {
      kind: "expiry",
      issuedIso: issued,
    });

  // Το precomputed expiry του μοντέλου μόνο αν λείπει το raw
  const expiryFallback = expiryFromRaw
    ? undefined
    : pickBestDate(
        "expiry",
        entry.expiry,
        entry.expiryDate,
        entry.validUntil
      );

  const expiry = sanitizeExpiry(issued, expiryFromRaw || expiryFallback);

  // Αν λήξη < έκδοση, δοκίμασε αντιστροφή στηλών 10↔11
  if (issued && !expiry && (entry.field10Raw || entry.field11Raw)) {
    const swappedIssued = normalizePrintedDate(entry.field11Raw, {
      kind: "issue",
    });
    const swappedExpiry = normalizePrintedDate(entry.field10Raw, {
      kind: "expiry",
      issuedIso: swappedIssued,
    });
    const fixed = sanitizeExpiry(swappedIssued, swappedExpiry);
    if (fixed) {
      return {
        code,
        issued: swappedIssued,
        expiry: fixed,
        codes: parseCodeList(
          entry.codes || entry.restrictions || entry.field12
        ),
      };
    }
  }

  return {
    code,
    issued,
    expiry,
    codes: parseCodeList(entry.codes || entry.restrictions || entry.field12),
  };
}

function normalizeCategoryDetails(raw: RawOcr): LicenseCategoryDetail[] {
  const buckets: RawCategory[] = [];
  if (Array.isArray(raw.licenseCategoryDetails)) {
    buckets.push(...raw.licenseCategoryDetails);
  }
  if (Array.isArray(raw.categoryDetails)) {
    buckets.push(...raw.categoryDetails);
  }
  if (Array.isArray(raw.categories)) {
    buckets.push(...raw.categories);
  }

  const byCode = new Map<string, LicenseCategoryDetail>();
  for (const entry of buckets) {
    const parsed = parseCategoryEntry(entry);
    if (!parsed) continue;
    const prev = byCode.get(parsed.code);
    byCode.set(parsed.code, {
      code: parsed.code,
      issued: parsed.issued || prev?.issued,
      // Στήλη 11: μην αντικαθιστάς σωστή λήξη με κενό
      expiry: parsed.expiry || prev?.expiry,
      codes: [...new Set([...(prev?.codes || []), ...(parsed.codes || [])])],
    });
  }
  return [...byCode.values()];
}

function summaryFromDetails(details: LicenseCategoryDetail[]) {
  const s = formatLicenseCategoriesSummary(
    details.map((d) => ({
      code: d.code,
      expiry: d.expiry,
      codes: d.codes,
      automaticOnly: d.codes?.includes("78"),
    }))
  );
  return s || undefined;
}

function normalizeLicenseFields(raw: RawOcr): LicenseOcrResult {
  const field4d = cleanDigits(
    String(raw.field4d || raw["4d"] || raw.afm || "").trim()
  );
  const field5 = cleanLicenseNo(
    String(raw.field5 || raw["5"] || raw.licenseNumber || "").trim()
  );

  let afm = field4d.slice(0, 9) || undefined;
  let licenseNumber = field5 || undefined;

  if (afm && /[A-Za-zΑ-Ωα-ω]/.test(String(raw.afm || ""))) {
    if (!licenseNumber) licenseNumber = cleanLicenseNo(String(raw.afm));
    afm = undefined;
  }

  if (afm && licenseNumber && afm === cleanDigits(licenseNumber)) {
    if (/[A-Za-zΑ-Ωα-ω]/.test(licenseNumber)) {
      afm = undefined;
    }
  }

  const licenseCategoryDetails = normalizeCategoryDetails(raw);

  return {
    firstName: latinOnlyName(raw.firstNameLatin, raw.firstName),
    lastName: latinOnlyName(raw.lastNameLatin, raw.lastName),
    licenseNumber,
    afm,
    licenseCategoryDetails,
    licenseCategories: summaryFromDetails(licenseCategoryDetails),
    licenseCountry: raw.licenseCountry?.trim() || undefined,
    idDocumentNo: raw.idDocumentNo?.trim() || undefined,
    dateOfBirth: normalizeDate(raw.dateOfBirth, { kind: "dob" }),
    licenseExpiry: normalizeDate(raw.licenseExpiry, { kind: "expiry" }),
    confidence: raw.confidence,
  };
}

function mergeOcrResults(
  front: LicenseOcrResult,
  back?: LicenseOcrResult | null
): LicenseOcrResult {
  if (!back) return front;
  const byCode = new Map<string, LicenseCategoryDetail>();
  for (const d of [
    ...(front.licenseCategoryDetails || []),
    ...(back.licenseCategoryDetails || []),
  ]) {
    const prev = byCode.get(d.code);
    byCode.set(d.code, {
      code: d.code,
      issued: d.issued || prev?.issued,
      expiry: d.expiry || prev?.expiry,
      codes: [...new Set([...(prev?.codes || []), ...(d.codes || [])])],
    });
  }
  const details = [...byCode.values()];
  return {
    firstName: front.firstName || back.firstName,
    lastName: front.lastName || back.lastName,
    licenseNumber: front.licenseNumber || back.licenseNumber,
    afm: front.afm || back.afm,
    licenseCountry: front.licenseCountry || back.licenseCountry,
    idDocumentNo: front.idDocumentNo || back.idDocumentNo,
    dateOfBirth: front.dateOfBirth || back.dateOfBirth,
    licenseExpiry: front.licenseExpiry || back.licenseExpiry,
    licenseCategoryDetails: details,
    licenseCategories: summaryFromDetails(details),
    confidence: front.confidence || back.confidence,
    rawText: [front.rawText, back.rawText].filter(Boolean).join("\n---\n"),
  };
}

function resolveOcrConfig() {
  const apiKey =
    process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || "";
  const endpoint = (
    process.env.OPENAI_BASE_URL ||
    (process.env.GROQ_API_KEY ? "https://api.groq.com/openai/v1" : "") ||
    "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  const isGroq = /groq\.com/i.test(endpoint);
  const configured = process.env.OPENAI_VISION_MODEL || "";
  const model = isGroq
    ? /qwen|muse|vision/i.test(configured)
      ? configured
      : "qwen/qwen3.8-27b"
    : configured || "gpt-4o-mini";
  return { apiKey, endpoint, model, isGroq };
}

async function callVisionJson(input: {
  apiKey: string;
  endpoint: string;
  model: string;
  isGroq: boolean;
  prompt: string;
  imageDataUrl: string;
}): Promise<LicenseOcrResult> {
  const body: Record<string, unknown> = {
    model: input.model,
    temperature: input.isGroq ? 0.2 : 0,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: input.prompt },
          { type: "image_url", image_url: { url: input.imageDataUrl } },
        ],
      },
    ],
    response_format: { type: "json_object" },
  };

  if (input.isGroq) {
    body.max_completion_tokens = 1400;
    body.reasoning_effort = "none";
  } else {
    body.max_tokens = 900;
  }

  const res = await fetch(`${input.endpoint}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    let detail = errBody.slice(0, 280);
    try {
      const parsed = JSON.parse(errBody) as {
        error?: { message?: string };
      };
      if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      /* keep raw */
    }
    throw new Error(`OCR_HTTP_${res.status}:${detail}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const reply = data.choices?.[0]?.message?.content || "";
  if (!reply.trim()) {
    throw new Error("OCR_EMPTY_RESPONSE");
  }
  const parsed = normalizeLicenseFields(extractJson(reply));
  return {
    ...parsed,
    rawText: reply.slice(0, 2500),
  };
}

const FRONT_PROMPT = `Read this Greek/EU driving licence FRONT side.
Return ONLY JSON:
{
  "firstNameLatin":"",
  "lastNameLatin":"",
  "firstName":"",
  "lastName":"",
  "field4d":"",
  "afm":"",
  "field5":"",
  "licenseNumber":"",
  "licenseCountry":"GR",
  "dateOfBirth":"YYYY-MM-DD",
  "licenseExpiry":"YYYY-MM-DD",
  "confidence":"high"
}
Rules:
- Names often appear in BOTH Greek and Latin. Put LATIN/Roman script ONLY into firstNameLatin and lastNameLatin (and also firstName/lastName). NEVER return Greek letters for names.
- Field 1 = surname, Field 2 = given names
- Field 3 = dateOfBirth, Field 4b = licenseExpiry — dates are DD.MM.YY (2-digit year!). Example: 15.03.31 means 2031-03-15. Convert carefully.
- Field 4d = AFM (usually 9 digits) → field4d AND afm. NEVER put 4d into licenseNumber.
- Field 5 = licence number → field5 AND licenseNumber. NEVER put 5 into afm.
Fill BOTH afm and licenseNumber when visible. Do not invent. No markdown.`;

const BACK_PROMPT = `Read this Greek/EU driving licence BACK side table carefully.
Columns (EU layout):
- Column 9 = category code (AM, A1, A2, A, B1, B, C1, C, D1, D, BE, C1E, CE, D1E, DE, …)
- Column 10 = date of issue for THAT row (optional)
- Column 11 = expiry / valid-to for THAT SAME horizontal row as column 9
- Column 12 = restriction codes for THAT SAME row (e.g. 78, 121). May be empty.

CRITICAL pairing: column 11 date belongs ONLY to the category on the SAME row in column 9. Never copy a year from another row.

DATES — most important:
- Greek licences print dates as DD.MM.YY with TWO-DIGIT year LEFT-TO-RIGHT: day . month . year
- Example printed "15.03.31" means day=15, month=03, year=31 → 2031-03-15 (NOT 2015-03-31)
- NEVER swap the first and last number groups. The LAST two digits are the year.
- For each row copy field10Raw and field11Raw EXACTLY as printed (e.g. "15.03.31"), character by character — do NOT expand to 4-digit year in the Raw fields
- Read each row independently. Do NOT copy a date from a neighbouring category row
- Also set expiry as YYYY-MM-DD by expanding YY → 20YY (15.03.31 → 2031-03-15). If unsure, leave expiry empty and keep field11Raw exact

Return ONLY JSON:
{
  "licenseCategoryDetails":[
    {"code":"B","field9":"B","field10Raw":"12.05.18","field11Raw":"15.03.31","expiry":"2031-03-15","field12":"78,121","codes":["78","121"]},
    {"code":"A","field9":"A","field10Raw":"01.01.20","field11Raw":"01.01.35","expiry":"2035-01-01","codes":[]}
  ],
  "confidence":"high"
}
Rules:
- One object per granted category row
- field11Raw is mandatory when column 11 is visible
- codes from column 12
- Include row even if column 11/12 blank
Do not invent. No markdown.`;

/** AI OCR διπλώματος — ξεχωριστά μπροστά + πίσω */
export async function ocrDriversLicense(
  frontImageDataUrl: string,
  backImageDataUrl?: string | null
): Promise<LicenseOcrResult> {
  const { apiKey, endpoint, model, isGroq } = resolveOcrConfig();
  if (!apiKey) {
    throw new Error("NO_OPENAI_KEY");
  }
  if (!frontImageDataUrl.startsWith("data:image/")) {
    throw new Error("OCR_HTTP_400:Μη έγκυρη μπροστινή εικόνα");
  }

  const approxBytes = Math.ceil((frontImageDataUrl.length * 3) / 4);
  if (approxBytes > 3_800_000) {
    throw new Error(
      "OCR_HTTP_400:Η μπροστινή φωτογραφία είναι πολύ μεγάλη — χρησιμοποίησε μικρότερη/συμπιεσμένη"
    );
  }

  const front = await callVisionJson({
    apiKey,
    endpoint,
    model,
    isGroq,
    prompt: FRONT_PROMPT,
    imageDataUrl: frontImageDataUrl,
  });

  const hasBack = Boolean(backImageDataUrl?.startsWith("data:image/"));
  if (!hasBack || !backImageDataUrl) {
    return front;
  }

  const backBytes = Math.ceil((backImageDataUrl.length * 3) / 4);
  if (backBytes > 3_800_000) {
    throw new Error(
      "OCR_HTTP_400:Η πίσω φωτογραφία είναι πολύ μεγάλη — χρησιμοποίησε μικρότερη/συμπιεσμένη"
    );
  }

  try {
    const back = await callVisionJson({
      apiKey,
      endpoint,
      model,
      isGroq,
      prompt: BACK_PROMPT,
      imageDataUrl: backImageDataUrl,
    });
    return mergeOcrResults(front, back);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    return {
      ...front,
      rawText: `${front.rawText || ""}\n[back OCR failed: ${msg}]`.slice(
        0,
        2500
      ),
    };
  }
}
