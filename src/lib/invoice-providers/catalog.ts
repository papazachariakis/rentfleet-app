/**
 * Κατάλογος παροχών βάσει αδειών ΑΑΔΕ (ΥΠΑΗΕΣ).
 * Πηγή: https://www.aade.gr/mydata/adeiodotimena-logismika-parohon-ilektronikis-timologisis
 */

export type ProviderIntegration =
  /** Άμεσο ΑΑΔΕ myDATA API */
  | "aade"
  /** Native Elorus REST */
  | "elorus"
  /** Generic REST/webhook — API key + URL */
  | "api";

export type InvoiceProviderDef = {
  id: string;
  /** Εμπορική ονομασία */
  name: string;
  /** Επωνυμία παρόχου */
  company: string;
  /** Κωδικός αναφοράς (όπου υπάρχει) */
  aadeCode?: string;
  integration: ProviderIntegration;
  /** Προτεινόμενο API/docs URL (βοήθεια UI) */
  docsUrl?: string;
  /** Προεπιλεγμένο base URL αν το ξέρουμε */
  defaultBaseUrl?: string;
  needsOrgId?: boolean;
  needsBaseUrl?: boolean;
  needsApiKey?: boolean;
  needsMeta?: boolean;
  needsMydataCreds?: boolean;
};

export const INVOICE_PROVIDERS: InvoiceProviderDef[] = [
  {
    id: "AADE",
    name: "ΑΑΔΕ myDATA (άμεσα)",
    company: "ΑΑΔΕ",
    integration: "aade",
    docsUrl: "https://www.aade.gr/mydata",
    needsMydataCreds: true,
  },
  {
    id: "SOFTONE",
    name: "SoftOne e-Invoicing",
    company: "ENTERSOFTONE ΑΕ",
    aadeCode: "001",
    integration: "api",
    needsApiKey: true,
    needsOrgId: true,
    needsBaseUrl: true,
    needsMeta: true,
  },
  {
    id: "ENTERSOFT",
    name: "Entersoft e-Invoicing",
    company: "ENTERSOFTONE ΑΕ",
    aadeCode: "002",
    integration: "api",
    needsApiKey: true,
    needsOrgId: true,
    needsBaseUrl: true,
    needsMeta: true,
  },
  {
    id: "IMPACT_MYDATA",
    name: "IMPACT myDATA connect",
    company: "Information systems IMPACT AE",
    aadeCode: "003",
    integration: "api",
    needsApiKey: true,
    needsOrgId: true,
    needsBaseUrl: true,
    needsMeta: true,
  },
  {
    id: "EPSILON",
    name: "EPSILONDIGITAL",
    company: "EPSILON NET AE",
    aadeCode: "004",
    integration: "api",
    needsApiKey: true,
    needsOrgId: true,
    needsBaseUrl: true,
    needsMeta: true,
  },
  {
    id: "TIMOLOGISI_ONLINE",
    name: "timologisi.online",
    company: "NOVUS CONCEPTUS Ο.Ε.",
    aadeCode: "005",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
  },
  {
    id: "OXYGEN",
    name: "Oxygen-Pelatologio",
    company: "CLOUD SERVICES I.K.E.",
    aadeCode: "006",
    integration: "api",
    needsApiKey: true,
    needsOrgId: true,
    needsBaseUrl: true,
  },
  {
    id: "PRIMER",
    name: "Primer MyData",
    company: "Primer Software ΙΚΕ",
    aadeCode: "007",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
    needsOrgId: true,
  },
  {
    id: "MEG",
    name: "Meg myData",
    company: "ΙΛΥΔΑ ΠΛΗΡΟΦΟΡΙΚΗ Α.Ε.",
    aadeCode: "008",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
    needsOrgId: true,
  },
  {
    id: "PROSVASIS",
    name: "PROSVASISGO eInvoicing",
    company: "PROSVASIS ΜΟΝΟΠΡΟΣΩΠΗ ΑΕΒΕ",
    aadeCode: "009",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
  },
  {
    id: "MAT",
    name: "MATRapidSign",
    company: "ΜΑΤ ΑΕ",
    aadeCode: "010",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
  },
  {
    id: "SIMPLY",
    name: "SIMPLY",
    company: "SIMPLY ΗΛΕΚΤΡΟΝΙΚΕΣ ΥΠΗΡΕΣΙΕΣ IKE",
    aadeCode: "011",
    integration: "api",
    needsApiKey: true,
    needsOrgId: true,
    needsBaseUrl: true,
  },
  {
    id: "ESKAP",
    name: "eskap",
    company: "KAPPA DEVELOPMENT Ο.Ε.",
    aadeCode: "012",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
  },
  {
    id: "EMDI",
    name: "EMDI",
    company: "SBZ IKE",
    aadeCode: "013",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
  },
  {
    id: "ONESIGN",
    name: "ONESIGN",
    company: "ONESYS I.K.E",
    aadeCode: "014",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
  },
  {
    id: "ORIAN",
    name: "Orian MyInvoices",
    company: "ORIAN ΣΥΣΤΗΜΑΤΑ ΠΛΗΡΟΦΟΡΙΚΗΣ ΑΕ",
    aadeCode: "015",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
    needsOrgId: true,
  },
  {
    id: "PEGASUS",
    name: "Pegasus e-invoicing",
    company: "ΤΕΣΑΕ Α.Τ.Ε.",
    aadeCode: "016",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
  },
  {
    id: "CLOUD_CRM",
    name: "Cloud CRM",
    company: "Karpodinis Software ΑΕ",
    aadeCode: "017",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
  },
  {
    id: "IMPACT_EINVOICE",
    name: "Impact eInvoicing",
    company: "Information systems IMPACT AE",
    aadeCode: "003",
    integration: "api",
    needsApiKey: true,
    needsOrgId: true,
    needsBaseUrl: true,
  },
  {
    id: "CLOUD_T",
    name: "Cloud T",
    company: "ΤΣΟΥΚΑΚΗΣ ΜΟΝ. ΙΚΕ",
    aadeCode: "018",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
  },
  {
    id: "PAROCHOS_ONLINE",
    name: "Parochos Online",
    company: "Πάροχος Λύσεων Πληροφορικής Α.Ε.",
    aadeCode: "019",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
    needsOrgId: true,
  },
  {
    id: "ETIMOLOGIERA",
    name: "etimologiera",
    company: "BRATNET E.E",
    aadeCode: "020",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
  },
  {
    id: "INVOICESOFT",
    name: "iNVOICEsoft",
    company: "INVOICESOFT ΜΟΝ. Ι.Κ.Ε.",
    aadeCode: "021",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
  },
  {
    id: "INVOICE_PORTAL",
    name: "Invoice Portal",
    company: "BUSINESS CLOUD EE",
    aadeCode: "022",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
    needsOrgId: true,
  },
  {
    id: "EDIWIN",
    name: "EDIWIN E-INVOICING",
    company: "EDICOM GREECE ΜΟΝ. Ι.Κ.Ε",
    aadeCode: "023",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
    needsOrgId: true,
    needsMeta: true,
  },
  {
    id: "INVOICELINK",
    name: "InvoiceLink",
    company: "MEGASOFT ΑΕ",
    aadeCode: "024",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
  },
  {
    id: "FISCALSIGN",
    name: "FiscalSign",
    company: "ΚΑΡΑΜΟΥΖΗΣ Κ ΚΑΝΕΛΛΟΠΟΥΛΟΥ Θ Ο Ε",
    aadeCode: "025",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
  },
  {
    id: "VIVA_FISCAL",
    name: "Viva Fiscal",
    company: "VIVABANK ΑΕ",
    aadeCode: "026",
    integration: "api",
    needsApiKey: true,
    needsOrgId: true,
    needsBaseUrl: true,
  },
  {
    id: "EON_RIX",
    name: "E-ON RIX",
    company: "E-ON INTEGRATION Α.Ε.",
    aadeCode: "027",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
  },
  {
    id: "SIMPLE_INVOICING",
    name: "Simple Invoicing",
    company: "Β BINARY ΑΕ",
    aadeCode: "028",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
  },
  {
    id: "WRAPP",
    name: "WRAPP",
    company: "WRAPP AE",
    aadeCode: "029",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
  },
  {
    id: "INVO_SIGN",
    name: "iNVO Sign",
    company: "ΓΕΩΡΓΑΚΟΠΟΥΛΟΣ Γ – ΚΑΡΙΝΟΣ Β Ο.Ε.",
    aadeCode: "030",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
  },
  {
    id: "CONTECH",
    name: "CONTECH E-INVOICE PROVIDER",
    company: "ΑΦΟΙ ΠΑΠΑΚΩΝΣΤΑΝΤΙΝΟΥ ΟΕ",
    aadeCode: "031",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
  },
  {
    id: "ELORUS",
    name: "Elorus Fuse",
    company: "ELORUS PRIVATE COMPANY",
    aadeCode: "032",
    integration: "elorus",
    docsUrl: "https://developer.elorus.com/",
    needsApiKey: true,
    needsOrgId: true,
    needsMeta: true,
  },
  {
    id: "ALPHA_PSIFIAKI",
    name: "ALPHA PSIFIAKI",
    company: "Ι ΑΜΠΕΛΙΩΤΗΣ ΚΑΙ ΣΙΑ Ε Ε",
    aadeCode: "033",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
  },
  {
    id: "ITIMOLOGIA",
    name: "iTimologia",
    company: "TECHNORAN A.E.",
    aadeCode: "034",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
  },
  {
    id: "CLOUDMATE",
    name: "CLOUDMATE INVOICE",
    company: "CLOUDMATE WEB SERVICES Ο.Ε.",
    aadeCode: "035",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
  },
  {
    id: "E_PAROXOS",
    name: "E-Paroxos",
    company: "GALEX E.E.",
    aadeCode: "036",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
  },
  {
    id: "E_INVOO",
    name: "e-invoo",
    company: "Methodoos ΙΚΕ",
    aadeCode: "037",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
  },
  {
    id: "AGILE",
    name: "AGILE Nexus-Hub",
    company: "AGILE ΑΕ",
    aadeCode: "038",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
    needsOrgId: true,
  },
  {
    id: "SOVOS",
    name: "Sovos Compliance Network",
    company: "Sovos Compliance Ελλάς ΜΟΝ. Ε.Π.Ε.",
    aadeCode: "039",
    integration: "api",
    needsApiKey: true,
    needsOrgId: true,
    needsBaseUrl: true,
    needsMeta: true,
  },
  {
    id: "MYTIMOLOGISI",
    name: "myTimologisi",
    company: "THESIS CLOUD ERP SOLUTIONS IKE",
    aadeCode: "041",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
    needsOrgId: true,
  },
  {
    id: "CUSTOM",
    name: "Άλλος / προσαρμοσμένος πάροχος",
    company: "Webhook / custom API",
    integration: "api",
    needsApiKey: true,
    needsBaseUrl: true,
    needsOrgId: true,
    needsMeta: true,
  },
];

const byId = new Map(INVOICE_PROVIDERS.map((p) => [p.id, p]));

export function getInvoiceProvider(id?: string | null): InvoiceProviderDef {
  if (!id) return byId.get("AADE")!;
  return byId.get(id.toUpperCase()) || byId.get("AADE")!;
}

export function isKnownInvoiceProvider(id: string) {
  return byId.has(id.toUpperCase());
}

export function invoiceProviderIds() {
  return INVOICE_PROVIDERS.map((p) => p.id);
}

export function providerOptionLabel(p: InvoiceProviderDef) {
  const code = p.aadeCode ? ` · ${p.aadeCode}` : "";
  return `${p.name}${code}`;
}
