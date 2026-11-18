/**
 * Ψηφιακό Πελατολόγιο Οχημάτων (Α.1057/2025)
 * Υποχρεωτικό για ενοικιάσεις από 1/7/2025.
 *
 * Offline mode: τοπική καταγραφή / ουρά.
 * Sandbox/live: REST API ΑΑΔΕ (όταν οριστούν endpoints credentials).
 */

export type ClientLedgerMode = "offline" | "sandbox" | "live";

export type RentalLedgerDeparture = {
  entityVatNumber?: string;
  branch: number;
  plateNumber: string;
  vehicleCategory?: string;
  make?: string;
  departureAt: Date;
  pickupPlace?: string;
  /** rental | own_use | free */
  movementPurpose: "rental" | "own_use" | "free";
  /** once | recurring | continuous */
  serviceType?: "once" | "recurring" | "continuous";
  customerAfm?: string;
  agreedAmount?: number;
};

export type RentalLedgerReturn = {
  ledgerId: string;
  returnAt: Date;
  returnPlace?: string;
  /** ALP | INVOICE | ALP_FHM */
  documentType?: "ALP" | "INVOICE" | "ALP_FHM";
};

export type LedgerResult = {
  ok: boolean;
  mode: ClientLedgerMode;
  ledgerId?: string;
  error?: string;
  payload?: unknown;
};

export function resolveClientLedgerMode(
  orgMode?: string | null
): ClientLedgerMode {
  const mode = (orgMode || process.env.CLIENT_LEDGER_MODE || "offline") as ClientLedgerMode;
  return ["offline", "sandbox", "live"].includes(mode) ? mode : "offline";
}

export async function submitDeparture(
  mode: ClientLedgerMode,
  data: RentalLedgerDeparture
): Promise<LedgerResult> {
  const payload = {
    clientServiceType: "rental",
    ...data,
    departureAt: data.departureAt.toISOString(),
  };

  if (mode === "offline") {
    return {
      ok: true,
      mode,
      ledgerId: `OFF-${Date.now()}-${data.plateNumber.replace(/\s+/g, "")}`,
      payload,
    };
  }

  // Placeholder για πραγματικό REST ΑΑΔΕ — credentials ανά org.
  return {
    ok: false,
    mode,
    error:
      "Το live/sandbox API Ψηφιακού Πελατολογίου θα συνδεθεί με credentials οργανισμού.",
    payload,
  };
}

export async function submitReturn(
  mode: ClientLedgerMode,
  data: RentalLedgerReturn
): Promise<LedgerResult> {
  const payload = {
    ...data,
    returnAt: data.returnAt.toISOString(),
  };

  if (mode === "offline") {
    return { ok: true, mode, ledgerId: data.ledgerId, payload };
  }

  return {
    ok: false,
    mode,
    error:
      "Το live/sandbox API Ψηφιακού Πελατολογίου θα συνδεθεί με credentials οργανισμού.",
    payload,
  };
}
