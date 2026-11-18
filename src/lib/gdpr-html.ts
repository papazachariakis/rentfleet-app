import { formatDateTime } from "@/lib/utils";
import type { BookingDocPayload } from "@/lib/booking-documents";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Έντυπο ενημέρωσης GDPR (άρ. 13) + βεβαίωση παραλαβής ενημέρωσης — όχι «εξαναγκασμένη» συγκατάθεση. */
export function buildGdprHtml(data: BookingDocPayload) {
  const driver = `${data.customer.firstName} ${data.customer.lastName}`;
  const v = data.agreement?.gdprVersion || "1.0";

  return `<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="utf-8" />
  <title>GDPR ${esc(data.code || "")}</title>
  <style>
    @page { margin: 16mm; }
    body { font-family: Georgia, "Times New Roman", serif; color: #0f1c2e; font-size: 11.5px; line-height: 1.45; }
    h1 { font-size: 17px; margin: 0 0 6px; }
    h2 { font-size: 13px; margin: 14px 0 6px; border-bottom: 1px solid #d5dde6; padding-bottom: 3px; }
    .muted { color: #5a6b7d; }
    ul { margin: 4px 0 0 16px; }
    .sign { margin-top: 28px; display: flex; gap: 36px; }
    .sign div { flex: 1; border-top: 1px solid #0f1c2e; padding-top: 8px; min-height: 70px; }
    .no-print { margin: 12px 0; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" style="padding:10px 16px;background:#1b6ca8;color:#fff;border:0;border-radius:8px;cursor:pointer">Εκτύπωση</button>
  </div>
  <h1>Έντυπο ενημέρωσης προστασίας δεδομένων προσωπικού χαρακτήρα (GDPR)</h1>
  <p class="muted">${esc(data.orgName)}${data.orgAfm ? ` · ΑΦΜ ${esc(data.orgAfm)}` : ""}${data.orgDoy ? ` · ΔΟΥ ${esc(data.orgDoy)}` : ""}</p>
  <p><strong>Κράτηση:</strong> ${esc(data.code || "—")} · ${formatDateTime(new Date())} · Έκδοση εντύπου v${esc(v)}</p>

  <h2>1. Υπεύθυνος επεξεργασίας</h2>
  <p>Υπεύθυνος επεξεργασίας είναι η επιχείρηση «${esc(data.orgName)}»${data.orgAfm ? ` (ΑΦΜ ${esc(data.orgAfm)})` : ""}. Τα δεδομένα συλλέγονται στο πλαίσιο σύμβασης ενοικίασης οχήματος χωρίς οδηγό.</p>

  <h2>2. Κατηγορίες δεδομένων</h2>
  <ul>
    <li>Στοιχεία ταυτότητας / διαβατηρίου και επικοινωνίας</li>
    <li>ΑΦΜ (όπου απαιτείται), άδεια οδήγησης και κατηγορίες</li>
    <li>Στοιχεία κράτησης, οχήματος, παραλαβής/επιστροφής και οικονομικά</li>
    <li>Προσωρινή σάρωση άδειας (PDF) έως την επιστροφή του οχήματος</li>
    <li>Φωτογραφίες / σημειώσεις ελέγχου παραλαβής–επιστροφής (αν υπάρχουν)</li>
  </ul>

  <h2>3. Σκοποί &amp; νομική βάση (άρ. 6 ΓΚΠΔ)</h2>
  <ul>
    <li><strong>Εκτέλεση σύμβασης</strong> (άρ. 6 παρ. 1β) — κράτηση, μίσθωση, εξυπηρέτηση</li>
    <li><strong>Νομική υποχρέωση</strong> (άρ. 6 παρ. 1γ) — φορολογία, ΑΑΔΕ/myDATA, Ψηφιακό Πελατολόγιο</li>
    <li><strong>Έννομο συμφέρον</strong> (άρ. 6 παρ. 1στ) — προστασία περιουσίας / αποτροπή απάτης, όπου εφαρμόζεται</li>
    <li><strong>Συγκατάθεση</strong> (άρ. 6 παρ. 1α) — μόνο για προαιρετική προωθητική επικοινωνία, αν δοθεί χωριστά</li>
  </ul>
  <p class="muted">Η παροχή της υπηρεσίας ενοικίασης δεν εξαρτάται από συγκατάθεση για marketing.</p>

  <h2>4. Χρόνος τήρησης</h2>
  <p>Τα δεδομένα τηρούνται όσο απαιτείται από τη σύμβαση και τη φορολογική/λογιστική νομοθεσία. Η σάρωση άδειας διαγράφεται μετά την ολοκλήρωση επιστροφής, εκτός αν υπάρχει νόμιμος λόγος διατήρησης (π.χ. εκκρεμής αξίωση).</p>

  <h2>5. Αποδέκτες</h2>
  <p>ΑΑΔΕ, πάροχος ηλεκτρονικής τιμολόγησης, πάροχος πληρωμών, πάροχοι φιλοξενίας/IT — μόνο όσο είναι απαραίτητο.</p>

  <h2>6. Δικαιώματά σας</h2>
  <p>Πρόσβαση, διόρθωση, διαγραφή (όπου επιτρέπεται), περιορισμός, φορητότητα, εναντίωση και καταγγελία στην Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα (www.dpa.gr).</p>

  <h2>7. Βεβαίωση παραλαβής ενημέρωσης</h2>
  <p>Ο/Η κάτωθι υπογεγραμμένος/η <strong>${esc(driver)}</strong> δηλώνει ότι έλαβε την ανωτέρω ενημέρωση πριν ή κατά τη σύναψη της σύμβασης ενοικίασης και ότι τα στοιχεία που δήλωσε είναι αληθή.</p>
  <p>☐ Επιθυμώ προαιρετικά να λαμβάνω ενημερώσεις / προσφορές (μπορώ να ανακαλέσω ανά πάσα στιγμή).</p>

  <div class="sign">
    <div>
      <strong>Για την εταιρεία</strong><br/>
      ${esc(data.orgName)}<br/>
      <span class="muted">Ημερομηνία: ____ / ____ / ________</span>
    </div>
    <div>
      <strong>Ο μισθωτής</strong><br/>
      ${esc(data.agreement?.gdprSignerName || driver)}<br/>
      ${
        data.agreement?.gdprSignedAt
          ? `<span class="muted">Υπογράφηκε: ${formatDateTime(data.agreement.gdprSignedAt)}</span>`
          : `<span class="muted">Υπογραφή: ________________</span><br/><span class="muted">Ημερομηνία: ____ / ____ / ________</span>`
      }
    </div>
  </div>
</body>
</html>`;
}
