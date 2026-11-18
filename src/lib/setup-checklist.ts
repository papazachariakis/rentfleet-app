import { prisma } from "@/lib/prisma";

export type SetupStep = {
  id: string;
  title: string;
  description: string;
  href: string;
  done: boolean;
  required: boolean;
};

export async function getSetupChecklist(organizationId: string) {
  const [org, branches, categories, vehicles, extras, priceRules, customers, agreements] =
    await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          name: true,
          afm: true,
          pytLicense: true,
          taxMode: true,
          clientLedgerMode: true,
          mydataUserId: true,
          invoiceProvider: true,
          invoiceProviderApiKey: true,
          stripeSecretKey: true,
          stripePublishableKey: true,
          stripeChargesEnabled: true,
          publicToken: true,
        },
      }),
      prisma.branch.count({
        where: { organizationId, active: true },
      }),
      prisma.vehicleCategory.count({
        where: { organizationId, active: true },
      }),
      prisma.vehicle.count({
        where: { organizationId, active: true },
      }),
      prisma.extra.count({
        where: { organizationId, active: true },
      }),
      prisma.priceRule.count({
        where: { organizationId, active: true },
      }),
      prisma.customer.count({ where: { organizationId } }),
      prisma.rentalAgreement.count({
        where: { booking: { organizationId } },
      }),
    ]);

  const availableVehicles = await prisma.vehicle.count({
    where: { organizationId, active: true, status: "AVAILABLE" },
  });

  const providerConfigured =
    Boolean(org?.invoiceProvider) &&
    (org?.invoiceProvider === "AADE" || Boolean(org?.invoiceProviderApiKey));

  const steps: SetupStep[] = [
    {
      id: "company",
      title: "Στοιχεία εταιρείας (ΑΦΜ)",
      description:
        "Βάλε ΑΦΜ, ΔΟΥ (και ΠΥΤ αν έχεις) στο /tax. Ξεκίνα myDATA + πελατολόγιο σε offline.",
      href: "/tax",
      done: Boolean(org?.afm && org.afm.length >= 9),
      required: true,
    },
    {
      id: "branches",
      title: "Κατάστημα",
      description: "Τουλάχιστον ένα ενεργό κατάστημα με διεύθυνση/πόλη.",
      href: "/branches",
      done: branches >= 1,
      required: true,
    },
    {
      id: "categories",
      title: "Κατηγορίες οχημάτων",
      description:
        "Όνομα, τύπος, €/ημέρα, εγγύηση — επεξεργάσιμες ανά πάσα στιγμή από /fleet.",
      href: "/fleet",
      done: categories >= 1,
      required: true,
    },
    {
      id: "vehicles",
      title: "Οχήματα διαθέσιμα",
      description:
        "Πρόσθεσε οχήματα, σύνδεσέ τα με κατηγορία· διόρθωση πινακίδας/ΚΤΕΟ/ασφάλειας από τον πίνακα.",
      href: "/fleet",
      done: availableVehicles >= 1,
      required: true,
    },
    {
      id: "pricing",
      title: "Extras ή κανόνες τιμής",
      description: "Προαιρετικά extras / season multipliers — καλό για online.",
      href: "/pricing",
      done: extras >= 1 || priceRules >= 1,
      required: false,
    },
    {
      id: "invoice-provider",
      title: "Πάροχος ηλεκτρονικής τιμολόγησης",
      description:
        "Επίλεξε από τη λίστα ΑΑΔΕ (ή άμεσο ΑΑΔΕ) και βάλε API credentials. Αρχικά κράτα offline.",
      href: "/tax",
      done: providerConfigured,
      required: false,
    },
    {
      id: "stripe",
      title: "Stripe keys",
      description:
        "Για online πληρωμές: publishable + secret + webhook στο /payments.",
      href: "/payments",
      done: Boolean(org?.stripeSecretKey && org?.stripePublishableKey),
      required: false,
    },
    {
      id: "booking-test",
      title: "Δοκιμαστική desk κράτηση",
      description:
        "Κράτηση → «Εκτύπωση για υπογραφή» (σύμβαση + GDPR) → check-out / check-in δοκιμής.",
      href: "/bookings/new",
      done: customers >= 1 && agreements >= 1,
      required: true,
    },
    {
      id: "public",
      title: "Δημόσιο booking link",
      description:
        "Μοιράσου το /book/… · ο πελάτης βλέπει μισθωτήριο PDF και PDF άδειας μετά την κράτηση.",
      href: org?.publicToken ? `/book/${org.publicToken}` : "/payments",
      done: Boolean(org?.publicToken) && availableVehicles >= 1 && categories >= 1,
      required: false,
    },
    {
      id: "maintenance",
      title: "Λήξεις ασφάλειας / ΚΤΕΟ",
      description: "Βάλε ημερομηνίες στα οχήματα ή καταχώρησε στο /maintenance.",
      href: "/maintenance",
      done: false, // computed below
      required: false,
    },
  ];

  const withExpiry = await prisma.vehicle.count({
    where: {
      organizationId,
      active: true,
      OR: [
        { insuranceExpiry: { not: null } },
        { kteoExpiry: { not: null } },
        { mechanicalExpiry: { not: null } },
      ],
    },
  });
  const maintStep = steps.find((s) => s.id === "maintenance");
  if (maintStep) maintStep.done = withExpiry >= 1;

  const requiredDone = steps.filter((s) => s.required && s.done).length;
  const requiredTotal = steps.filter((s) => s.required).length;
  const optionalDone = steps.filter((s) => !s.required && s.done).length;
  const optionalTotal = steps.filter((s) => !s.required).length;
  const readyForDesk = steps
    .filter((s) => s.required)
    .every((s) => s.done);
  const readyForOnline =
    readyForDesk && Boolean(org?.stripeSecretKey && org?.publicToken);

  return {
    org,
    steps,
    progress: {
      requiredDone,
      requiredTotal,
      optionalDone,
      optionalTotal,
      readyForDesk,
      readyForOnline,
      vehicles,
      availableVehicles,
      categories,
      branches,
    },
    publicBookUrl: org?.publicToken ? `/book/${org.publicToken}` : null,
  };
}
