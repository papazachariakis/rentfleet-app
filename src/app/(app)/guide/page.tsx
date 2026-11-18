import Link from "next/link";
import { getSession } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display mt-10 text-xl text-foreground first:mt-0">
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>;
}

function Ol({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ol>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-muted">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-muted">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function GuidePage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div>
      <PageHeader
        title="Οδηγός στησίματος"
        description="Βήμα βήμα για νέο rent-a-car · στόλος, σύμβαση + GDPR, ΑΑΔΕ & πάροχος τιμολόγησης"
        actions={
          <Link
            href="/setup"
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-dark"
          >
            Ζωντανό checklist
          </Link>
        }
      />

      <Card className="prose-rentfleet max-w-3xl space-y-1">
        <P>
          Καλωσόρισες στο RentFleet. Ακολούθησε τη σειρά παρακάτω. Παράλληλα
          άνοιξε το{" "}
          <Link href="/setup" className="text-accent hover:underline">
            /setup
          </Link>{" "}
          για να βλέπεις τι έχει ολοκληρωθεί.
        </P>

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Την 1η μέρα κράτα <strong>myDATA</strong> και{" "}
          <strong>Ψηφιακό Πελατολόγιο</strong> σε <strong>offline</strong>.
          Δοκίμασε παραλαβή → επιστροφή → PDF πριν περάσεις σε sandbox/live ή
          σε live πάροχο τιμολόγησης.
        </div>

        <H2>Βήμα 0 — Προετοιμασία</H2>
        <Ol
          items={[
            "Επωνυμία, ΑΦΜ, ΔΟΥ, άδεια ΠΥΤ (αν υπάρχει)",
            "Καταστήματα: διεύθυνση, πόλη, τηλέφωνο",
            "Στόλος: πινακίδες, τιμές κατηγορίας / οχήματος, εγγυήσεις",
            "Λήξεις ασφάλειας / ΚΤΕΟ / μηχανολογικού",
            "Πάροχος τιμολόγησης (SoftOne, Elorus, IMPACT… ή άμεσο ΑΑΔΕ) + API keys",
            "Stripe keys (αν θέλεις online πληρωμές)",
          ]}
        />

        <H2>Βήμα 1 — Εγγραφή</H2>
        <P>
          Πήγαινε στο{" "}
          <a href="/register" className="text-accent hover:underline">
            /register
          </a>
          : όνομα, email, κωδικός, όνομα εταιρείας. Δημιουργούνται αυτόματα
          οργανισμός, κατάστημα «Κεντρικό» και δημόσιο booking token.
        </P>

        <H2>Βήμα 2 — Checklist /setup</H2>
        <P>
          Μενού <strong>Στήσιμο</strong>. Ολοκλήρωσε όσα είναι υποχρεωτικά
          (ΑΦΜ, κατηγορίες, οχήματα, δοκιμαστική κράτηση με εκτύπωση σύμβασης +
          GDPR). Τα προαιρετικά (πάροχος τιμολόγησης, Stripe, extras, λήξεις)
          μετά.
        </P>

        <H2>Βήμα 3 — Καταστήματα</H2>
        <P>
          <Link href="/branches" className="text-accent hover:underline">
            /branches
          </Link>{" "}
          — διεύθυνση/πόλη/τηλ. Κωδικός ΑΑΔΕ εγκατάστασης: βάλε 0 μέχρι να
          πάρεις επίσημο.
        </P>

        <H2>Βήμα 4 — Στόλος</H2>
        <P>
          <Link href="/fleet" className="text-accent hover:underline">
            /fleet
          </Link>
        </P>
        <Table
          headers={["Ενέργεια", "Τι κάνεις"]}
          rows={[
            [
              "Κατηγορία",
              "Όνομα, τύπος (CAR/MOTO…), €/ημέρα, εγγύηση — «Διόρθωση» ή διαγραφή/νέα ανά πάσα στιγμή",
            ],
            ["Νέο όχημα", "Πινακίδα, μάρκα/μοντέλο, κατηγορία, κατάστημα"],
            [
              "Διόρθωση οχήματος",
              "Κουμπί «Διόρθωση» — πινακίδα, χλμ, κατάσταση, καύσιμο, ΚΤΕΟ, ασφάλεια, μηχανολογικό, σημειώσεις",
            ],
            ["Status", "AVAILABLE για κρατήσεις · αλλιώς δεν εμφανίζεται"],
            [
              "Απενεργοποίηση",
              "Κρύβει το όχημα από νέες κρατήσεις (μπορεί επανενεργοποίηση)",
            ],
          ]}
        />

        <H2>Βήμα 5 — Τιμές & extras</H2>
        <P>
          <Link href="/pricing" className="text-accent hover:underline">
            /pricing
          </Link>{" "}
          — extras (κάθισμα, GPS) και κανόνες σεζόν (π.χ. multiplier 1.3). Η
          βασική ημερήσια τιμή / εγγύηση ορίζεται στην{" "}
          <strong>κατηγορία</strong> στο /fleet. Στη νέα κράτηση το σύστημα
          προτείνει την τιμή του οχήματος (ή της κατηγορίας) και μπορείς να την
          διορθώσεις χειροκίνητα πριν την αποθήκευση.
        </P>

        <H2>Βήμα 6 — ΑΑΔΕ & πάροχος τιμολόγησης</H2>
        <P>
          <Link href="/tax" className="text-accent hover:underline">
            /tax
          </Link>{" "}
          — συμπλήρωσε ΑΦΜ, ΔΟΥ, σειρά παραστατικών (π.χ. RF), ΦΠΑ 24%
          (κατηγορία 1).
        </P>
        <Ol
          items={[
            <>
              Επίλεξε <strong>πάροχο ηλεκτρονικής τιμολόγησης</strong> από την
              επίσημη λίστα ΑΑΔΕ (SoftOne, Entersoft, IMPACT, Epsilon, Elorus,
              Simply, Invoice Portal, Meg, Primer, Oxygen… ή άμεσο ΑΑΔΕ
              myDATA).
            </>,
            "Αναζήτησε με όνομα ή κωδικό και αποθήκευσε API key / Organization ID / Webhook URL που σου δίνει ο πάροχος.",
            <>
              Πάτα <strong>Αποθήκευση & έλεγχος σύνδεσης</strong> πριν το live.
            </>,
            "Την 1η μέρα: myDATA mode + Πελατολόγιο mode = offline.",
            "Όταν είσαι έτοιμος: sandbox δοκιμή → μετά live.",
          ]}
        />
        <Table
          headers={["Στιγμή", "Τι γίνεται"]}
          rows={[
            ["Check-out (παραλαβή)", "Ψηφιακό Πελατολόγιο ΑΑΔΕ"],
            [
              "Check-in (επιστροφή)",
              "Κλείσιμο πελατολογίου + έκδοση ΑΠΥ μέσω του επιλεγμένου παρόχου (τύπος 11.2)",
            ],
            ["FAILED", "Retry από την κράτηση ή από /tax"],
          ]}
        />
        <P>
          Πίνακας αδειών ΑΑΔΕ:{" "}
          <a
            href="https://www.aade.gr/mydata/adeiodotimena-logismika-parohon-ilektronikis-timologisis"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            aade.gr — αδειοδοτημένα λογισμικά
          </a>
          .
        </P>

        <H2>Βήμα 7 — Stripe</H2>
        <Ol
          items={[
            <>
              <Link href="/payments" className="text-accent hover:underline">
                /payments
              </Link>
              : Publishable + Secret key
            </>,
            "Stripe → Webhooks → URL που δείχνει η σελίδα",
            "Event: checkout.session.completed",
            "Signing secret (whsec_…) πίσω στο RentFleet",
          ]}
        />

        <H2>Βήμα 8 — Online booking</H2>
        <P>
          Το link <code className="text-foreground">/book/ΤΟ_TOKEN</code> είναι
          στο setup / payments / dashboard. Δοκίμασέ το σε ιδιωτικό παράθυρο και
          βάλε το στο site σου.
        </P>
        <Ol
          items={[
            "Ο πελάτης διαλέγει κατηγορία / ημερομηνίες — εμφανίζονται μόνο διαθέσιμα οχήματα.",
            "OCR άδειας οδήγησης (μπροστά + πίσω): συμπληρώνει όνομα, ΑΦΜ, αριθμό άδειας, κατηγορίες/λήξεις.",
            "Τα πεδία διορθώνονται χειροκίνητα αν το OCR κάνει λάθος.",
            "Αν λείπει/έχει λήξει η κατηγορία για τον τύπο οχήματος, η κράτηση μπλοκάρεται.",
            "Μετά την κράτηση δημιουργείται σύμβαση· σελίδα επιτυχίας με μισθωτήριο PDF + PDF άδειας (αν σαρώθηκε).",
            "Email επιβεβαίωσης (αν υπάρχει Resend): συνημμένα PDF + σύνδεσμοι.",
            "Στο desk άνοιξε την κράτηση για «Εκτύπωση για υπογραφή» (σύμβαση + GDPR) πριν την παραλαβή.",
          ]}
        />

        <H2>Βήμα 9 — Πρώτη desk κράτηση</H2>
        <Ol
          items={[
            <>
              <Link
                href="/bookings/new"
                className="text-accent hover:underline"
              >
                Νέα κράτηση
              </Link>
            </>,
            "Φίλτρο κατηγορίας + ημερομηνιών — κρυμμένα τα ήδη νοικιασμένα οχήματα.",
            "Σάρωση άδειας (OCR) ή υπάρχων πελάτης · διόρθωση κατηγοριών/λήξεων.",
            "Οι φωτογραφίες άδειας αποθηκεύονται ως PDF στην κράτηση μέχρι την επιστροφή.",
            "Με την αποθήκευση δημιουργείται αυτόματα η σύμβαση ενοικίασης.",
            <>
              Πάτα <strong>Εκτύπωση για υπογραφή</strong> — πακέτο 2 σελίδων:
              σύμβαση μίσθωσης (χωρίς οδηγό) + έντυπο ενημέρωσης GDPR (άρ. 13).
            </>,
            "Εναλλακτικά: ηλεκτρονική υπογραφή στο desk + ξεχωριστά PDF σύμβασης / GDPR.",
            "Παραλαβή (φωτό, χλμ) → ΑΑΔΕ πελατολόγιο.",
            "Επιστροφή → ΑΑΔΕ + παραστατικό μέσω παρόχου · το PDF άδειας διαγράφεται.",
          ]}
        />

        <H2>Βήμα 9β — Σύμβαση &amp; GDPR (τι εκτυπώνεις)</H2>
        <P>
          Στο RentFleet η σύμβαση αφορά{" "}
          <strong>ενοικίαση οχήματος χωρίς οδηγό</strong> (όχι ΕΙΧ με οδηγό).
          Το πακέτο υπογραφής ανοίγει από την κράτηση και περιλαμβάνει:
        </P>
        <Table
          headers={["Έγγραφο", "Περιεχόμενο"]}
          rows={[
            [
              "Σύμβαση",
              "Συμβαλλόμενοι, όχημα/πινακίδα, χρόνος–τόπος, τίμημα/εγγύηση/καλύψεις, όροι χρήσης, χώροι υπογραφής",
            ],
            [
              "GDPR",
              "Ενημέρωση άρ. 13 (υπεύθυνος, δεδομένα, νομικές βάσεις, χρόνος τήρησης, δικαιώματα) + βεβαίωση παραλαβής — όχι εξαναγκασμένη συγκατάθεση marketing",
            ],
          ]}
        />
        <P>
          Στην κάρτα κράτησης η ενότητα <strong>Έγγραφα πελάτη</strong> έχει
          Εκτύπωση για υπογραφή, Σύμβαση PDF, GDPR PDF και προεπισκόπηση άδειας
          όσο η ενοικίαση είναι ενεργή.
        </P>

        <H2>Βήμα 10 — Ημερολόγιο / χάρτης / συντήρηση / reports</H2>
        <Table
          headers={["Σελίδα", "Χρήση"]}
          rows={[
            [
              <Link
                key="c"
                href="/calendar"
                className="text-accent hover:underline"
              >
                /calendar
              </Link>,
              "Διαθεσιμότητα στόλου",
            ],
            [
              <Link key="m" href="/map" className="text-accent hover:underline">
                /map
              </Link>,
              "Θέσεις οχημάτων (χειροκίνητα ή τηλεματική)",
            ],
            [
              <Link
                key="maint"
                href="/maintenance"
                className="text-accent hover:underline"
              >
                /maintenance
              </Link>,
              "Service, ΚΤΕΟ, alerts λήξης",
            ],
            [
              <Link
                key="r"
                href="/reports"
                className="text-accent hover:underline"
              >
                /reports
              </Link>,
              "Έσοδα, utilization, κανάλια",
            ],
            [
              <Link
                key="t"
                href="/telematics"
                className="text-accent hover:underline"
              >
                /telematics
              </Link>,
              "Συσκευές GPS/OBD (προαιρετικά)",
            ],
          ]}
        />

        <H2>Βήμα 11 — Ομάδα</H2>
        <P>
          <Link href="/team" className="text-accent hover:underline">
            /team
          </Link>{" "}
          — Διαχειριστής / Γκισέ / Μόνο ανάγνωση. Μόνο admin προσθέτει μέλη.
        </P>

        <H2>Βήμα 12 — Καθημερινά</H2>
        <Ol
          items={[
            "Πρωί: dashboard + calendar",
            "Παραλαβή: OCR/έλεγχος άδειας → Εκτύπωση για υπογραφή (σύμβαση + GDPR) → check-out → ΑΑΔΕ OK",
            "Επιστροφή: check-in → παραστατικό παρόχου → διαγραφή PDF άδειας",
            "Εβδομάδα: reports + maintenance λήξεις + έλεγχος σύνδεσης /tax",
          ]}
        />

        <H2>Λίστα «είμαι live»</H2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Setup υποχρεωτικά πράσινα</li>
          <li>ΑΦΜ + πάροχος τιμολόγησης ρυθμισμένος (αρχικά offline)</li>
          <li>≥1 κατάστημα, κατηγορία (επεξεργάσιμη), όχημα AVAILABLE</li>
          <li>
            Desk: Εκτύπωση για υπογραφή → check-out → check-in + παραστατικό
          </li>
          <li>Δοκιμή OCR άδειας (μπροστά+πίσω) και διόρθωση πεδίων</li>
          <li>(Προαιρετικά) Stripe + /book δοκιμή</li>
          <li>(Προαιρετικά) team + λήξεις + τηλεματική</li>
        </ul>

        <H2>Συχνά προβλήματα</H2>
        <Table
          headers={["Πρόβλημα", "Λύση"]}
          rows={[
            ["Όχημα μη διαθέσιμο", "Calendar / status AVAILABLE / φίλτρο ημερομηνιών"],
            ["Online άδειο", "Κατηγορίες + οχήματα AVAILABLE χωρίς σύγκρουση"],
            ["Stripe error", "Keys + webhook"],
            [
              "Πάροχος / myDATA FAILED",
              "Έλεγχος σύνδεσης στο /tax · Retry · κράτα offline στην αρχή",
            ],
            [
              "OCR λάθος ημερομηνίες/ΑΦΜ",
              "Διόρθωσε χειροκίνητα τις κατηγορίες (λήξη ΕΕΕΕ-ΜΜ-ΗΗ) πριν την κράτηση",
            ],
            [
              "Μπλοκ κατηγορίας άδειας",
              "Έλεγξε λήξη κατηγορίας στο πίσω μέρος της άδειας (στήλη 11) και κωδικούς 78/121",
            ],
            ["Χωρίς PDF άδειας", "Χρειάζεται σάρωση στο OCR πριν την αποθήκευση κράτησης"],
            [
              "Χωρίς πακέτο υπογραφής",
              "Άνοιξε την κράτηση → «Εκτύπωση για υπογραφή» (δημιουργεί σύμβαση αν λείπει)",
            ],
            ["Χωρίς email", "RESEND_API_KEY (πλατφόρμα)"],
            ["«Μόνο διαχειριστής»", "Αναβάθμιση ρόλου στο /team"],
          ]}
        />

        <div className="mt-10 flex flex-wrap gap-3 border-t border-border pt-6">
          <Link
            href="/setup"
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-dark"
          >
            Άνοιγμα checklist
          </Link>
          <Link
            href="/tax"
            className="rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-slate-50"
          >
            ΑΑΔΕ & πάροχος
          </Link>
          <Link
            href="/bookings/new"
            className="rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-slate-50"
          >
            Νέα κράτηση
          </Link>
        </div>
      </Card>
    </div>
  );
}
