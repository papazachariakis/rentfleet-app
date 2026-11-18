/** Δημόσιος κωδικός κράτησης από όνομα εταιρείας, π.χ. "Aegean Rent" → AEG-X7K2 */
export function makeBookingCode(orgName: string) {
  const prefix = orgName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${rand}`;
}
