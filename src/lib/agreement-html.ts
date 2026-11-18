import { formatCurrency, formatDateTime, vehicleTypeLabel } from "@/lib/utils";
import type { BookingDocPayload } from "@/lib/booking-documents";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Σύμβαση μίσθωσης οχήματος χωρίς οδηγό — για εκτύπωση & υπογραφή. */
export function buildAgreementHtml(data: BookingDocPayload) {
  const driver = `${data.customer.firstName} ${data.customer.lastName}`;
  const vehicleLine = data.vehicle
    ? `${data.vehicle.make} ${data.vehicle.model}${
        data.vehicle.year ? ` (${data.vehicle.year})` : ""
      } · ${data.vehicle.plateNumber} · ${vehicleTypeLabel(data.vehicle.vehicleType)}`
    : "—";
  const draftedAt = formatDateTime(new Date());
  const termsV = data.agreement?.termsVersion || "1.1";

  return `<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="utf-8" />
  <title>Σύμβαση ενοικίασης ${esc(data.code || "")}</title>
  <style>
    @page { margin: 14mm; }
    body { font-family: Georgia, "Times New Roman", serif; color: #0f1c2e; font-size: 11.5px; line-height: 1.42; }
    h1 { font-size: 17px; margin: 0 0 4px; }
    h2 { font-size: 12.5px; margin: 12px 0 6px; border-bottom: 1px solid #d5dde6; padding-bottom: 3px; }
    .muted { color: #5a6b7d; }
    .row { display: flex; justify-content: space-between; gap: 12px; margin: 3px 0; }
    .box { border: 1px solid #d5dde6; border-radius: 6px; padding: 10px; margin-top: 6px; }
    .sign { margin-top: 28px; display: flex; gap: 36px; }
    .sign div { flex: 1; border-top: 1px solid #0f1c2e; padding-top: 8px; min-height: 72px; }
    .no-print { margin: 12px 0; }
    ul { margin: 4px 0 0 16px; padding: 0; }
    @media print { .no-print { display: none !important; } body { font-size: 10.5px; } }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" style="padding:10px 16px;background:#1b6ca8;color:#fff;border:0;border-radius:8px;cursor:pointer;font-size:14px">
      Εκτύπωση / Αποθήκευση PDF
    </button>
  </div>

  <h1>Σύμβαση μίσθωσης οχήματος (χωρίς οδηγό)</h1>
  <p class="muted">${esc(data.orgName)}${data.orgAfm ? ` · ΑΦΜ ${esc(data.orgAfm)}` : ""}${data.orgDoy ? ` · ΔΟΥ ${esc(data.orgDoy)}` : ""}${data.pytLicense ? ` · ΠΥΤ ${esc(data.pytLicense)}` : ""}</p>
  <p><strong>Αρ. κράτησης / σύμβασης:</strong> ${esc(data.code || "—")} · <strong>Κατάρτιση:</strong> ${draftedAt} · Όροι v${esc(termsV)}</p>

  <h2>1. Συμβαλλόμενοι</h2>
  <div class="box">
    <div class="row"><span>Εκμισθωτής</span><strong>${esc(data.orgName)}${data.orgAfm ? ` · ΑΦΜ ${esc(data.orgAfm)}` : ""}</strong></div>
    <div class="row"><span>Μισθωτής / κύριος οδηγός</span><strong>${esc(driver)}</strong></div>
    <div class="row"><span>Email / Τηλ.</span><span>${esc(data.customer.email || "—")} · ${esc(data.customer.phone || "—")}</span></div>
    <div class="row"><span>ΑΦΜ / Έγγραφο ταυτοποίησης</span><span>${data.customer.isForeign ? "Αλλοδαπός" : esc(data.customer.afm || "—")} · ${esc(data.customer.idDocumentNo || "—")}</span></div>
    <div class="row"><span>Άδεια οδήγησης</span><span>${esc(data.customer.licenseNumber || "—")}</span></div>
  </div>

  <h2>2. Αντικείμενο μίσθωσης (όχημα)</h2>
  <div class="box">
    <div class="row"><span>Όχημα</span><strong>${esc(vehicleLine)}</strong></div>
    <div class="row"><span>Αριθμός κυκλοφορίας</span><strong>${esc(data.vehicle?.plateNumber || "—")}</strong></div>
  </div>

  <h2>3. Χρόνος &amp; τόπος</h2>
  <div class="box">
    <div class="row"><span>Παραλαβή (έναρξη)</span><span>${formatDateTime(data.pickupAt)}${data.pickupBranch ? ` · ${esc(data.pickupBranch)}` : ""}</span></div>
    <div class="row"><span>Επιστροφή (λήξη)</span><span>${formatDateTime(data.returnAt)}</span></div>
    <div class="row"><span>Διάρκεια</span><span>${data.days} ημέρα/ες</span></div>
  </div>

  <h2>4. Τίμημα &amp; εγγύηση</h2>
  <div class="box">
    <div class="row"><span>Ημερήσιο μίσθωμα</span><span>${formatCurrency(data.dailyRate)}</span></div>
    <div class="row"><span>Σύνολο μισθώματος (με ΦΠΑ)</span><strong>${formatCurrency(data.totalAmount)}</strong></div>
    <div class="row"><span>ΦΠΑ</span><span>${formatCurrency(data.vatAmount)}</span></div>
    <div class="row"><span>Εγγύηση (επιστρεπτέα υπό όρους)</span><span>${formatCurrency(data.depositAmount)}</span></div>
    <div class="row"><span>Καλύψεις / απαλλαγές</span><span>${esc(data.coverages.join(", ") || "Βασική αστική ευθύνη")}</span></div>
  </div>

  <h2>5. Όροι χρήσης</h2>
  <ul>
    <li>Ο μισθωτής δηλώνει ότι κατέχει έγκυρη άδεια οδήγησης κατάλληλη για τον τύπο του οχήματος και ότι είναι σε θέση να το οδηγεί νόμιμα.</li>
    <li>Το όχημα παραδίδεται στην κατάσταση που καταγράφεται στον έλεγχο παραλαβής (χιλιόμετρα, καύσιμο, ζημιές/φωτογραφίες). Ο μισθωτής οφείλει να το επιστρέψει στην ίδια κατάσταση, με την ίδια ποσότητα καυσίμου, εκτός αν συμφωνηθεί διαφορετικά.</li>
    <li>Απαγορεύεται η υπεκμίσθωση, η μεταφορά επιβατών/φορτίου έναντι αμοιβής, η συμμετοχή σε αγώνες, η οδήγηση υπό επήρεια αλκοόλ/ουσιών και η οδήγηση από μη δηλωμένους οδηγούς.</li>
    <li>Ο μισθωτής ευθύνεται για παραβάσεις Κ.Ο.Κ. και διοικητικά πρόστιμα κατά τη διάρκεια της μίσθωσης.</li>
    <li>Σε περίπτωση ατυχήματος/ζημίας ενημερώνει αμέσως την εταιρεία και τις αρμόδιες αρχές όπου απαιτείται· εφαρμόζονται οι συμφωνημένες καλύψεις και απαλλαγές.</li>
    <li>Η εταιρεία δύναται να καταγγείλει τη σύμβαση αν ο μισθωτής παραβιάζει ουσιωδώς τους όρους ή θέτει σε κίνδυνο το όχημα/τρίτους.</li>
    <li>Για φορολογικούς σκοπούς τηρείται Ψηφιακό Πελατολόγιο ΑΑΔΕ και εκδίδεται το προβλεπόμενο παραστατικό.</li>
  </ul>
  ${data.notes ? `<p><strong>Ειδικές σημειώσεις:</strong> ${esc(data.notes)}</p>` : ""}

  <h2>6. Δηλώσεις</h2>
  <p>Ο μισθωτής δηλώνει ότι έλαβε αντίγραφο της παρούσας σύμβασης και του εντύπου ενημέρωσης προστασίας δεδομένων (GDPR) και συμφωνεί με τους ανωτέρω όρους.</p>

  <div class="sign">
    <div>
      <strong>Ο εκμισθωτής</strong><br/>
      ${esc(data.orgName)}<br/>
      <span class="muted">Υπογραφή / σφραγίδα</span><br/>
      <span class="muted">Ημερομηνία: ____ / ____ / ________</span>
    </div>
    <div>
      <strong>Ο μισθωτής</strong><br/>
      ${esc(data.agreement?.signerName || driver)}<br/>
      ${
        data.agreement?.signedAt
          ? `<span class="muted">Υπογράφηκε ηλεκτρονικά: ${formatDateTime(data.agreement.signedAt)}</span>`
          : `<span class="muted">Υπογραφή: ________________</span><br/><span class="muted">Ημερομηνία: ____ / ____ / ________</span>`
      }
    </div>
  </div>
</body>
</html>`;
}
