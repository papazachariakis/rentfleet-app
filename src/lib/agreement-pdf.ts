import PDFDocument from "pdfkit";
import path from "path";
import { formatCurrency, formatDateTime, vehicleTypeLabel } from "@/lib/utils";
import type { BookingDocPayload } from "@/lib/booking-documents";

function fontPath(file: string) {
  return path.join(process.cwd(), "assets", "fonts", file);
}

function line(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  width: number
) {
  const y = doc.y;
  doc.font("Regular").fillColor("#5a6b7d").text(label, x, y, { width: 140 });
  doc.font("Bold").fillColor("#0f1c2e").text(value, x + 145, y, {
    width: width - 145,
  });
  doc.moveDown(0.35);
}

/** Σύμβαση μίσθωσης οχήματος χωρίς οδηγό — PDF για αρχείο / email. */
export async function buildAgreementPdf(
  data: BookingDocPayload
): Promise<Buffer> {
  const driver = `${data.customer.firstName} ${data.customer.lastName}`;
  const vehicleLine = data.vehicle
    ? `${data.vehicle.make} ${data.vehicle.model}${
        data.vehicle.year ? ` (${data.vehicle.year})` : ""
      } · ${data.vehicle.plateNumber} · ${vehicleTypeLabel(data.vehicle.vehicleType)}`
    : "—";
  const termsV = data.agreement?.termsVersion || "1.1";

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 48, bottom: 48, left: 48, right: 48 },
      info: {
        Title: `Σύμβαση ενοικίασης ${data.code || ""}`,
        Author: data.orgName,
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("Regular", fontPath("DejaVuSans.ttf"));
    doc.registerFont("Bold", fontPath("DejaVuSans-Bold.ttf"));
    // Αποφυγή default Helvetica (λείπει συχνά στο Vercel bundle)
    doc.font("Regular");

    const contentWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;

    doc
      .font("Bold")
      .fontSize(15)
      .fillColor("#0f1c2e")
      .text("Σύμβαση μίσθωσης οχήματος (χωρίς οδηγό)", left, doc.y, {
        width: contentWidth,
      });
    doc.moveDown(0.25);
    doc
      .font("Regular")
      .fontSize(9)
      .fillColor("#5a6b7d")
      .text(
        `${data.orgName}${data.orgAfm ? ` · ΑΦΜ ${data.orgAfm}` : ""}${
          data.orgDoy ? ` · ΔΟΥ ${data.orgDoy}` : ""
        }${data.pytLicense ? ` · ΠΥΤ ${data.pytLicense}` : ""}`,
        { width: contentWidth }
      );
    doc
      .fillColor("#0f1c2e")
      .text(
        `Αρ. κράτησης / σύμβασης: ${data.code || "—"} · Κατάρτιση: ${formatDateTime(new Date())} · Όροι v${termsV}`,
        { width: contentWidth }
      );
    doc.moveDown(0.7);

    const section = (title: string) => {
      doc.moveDown(0.35);
      doc
        .font("Bold")
        .fontSize(11)
        .fillColor("#0f1c2e")
        .text(title, { width: contentWidth });
      doc
        .moveTo(left, doc.y + 2)
        .lineTo(left + contentWidth, doc.y + 2)
        .strokeColor("#d5dde6")
        .stroke();
      doc.moveDown(0.45);
      doc.fontSize(10);
    };

    section("1. Συμβαλλόμενοι");
    line(doc, "Εκμισθωτής", `${data.orgName}${data.orgAfm ? ` · ΑΦΜ ${data.orgAfm}` : ""}`, left, contentWidth);
    line(doc, "Μισθωτής / οδηγός", driver, left, contentWidth);
    line(
      doc,
      "Email / Τηλ.",
      `${data.customer.email || "—"} · ${data.customer.phone || "—"}`,
      left,
      contentWidth
    );
    line(
      doc,
      "ΑΦΜ / Έγγραφο",
      `${data.customer.isForeign ? "Αλλοδαπός" : data.customer.afm || "—"} · ${
        data.customer.idDocumentNo || "—"
      }`,
      left,
      contentWidth
    );
    line(doc, "Άδεια οδήγησης", data.customer.licenseNumber || "—", left, contentWidth);

    section("2. Αντικείμενο μίσθωσης");
    line(doc, "Όχημα", vehicleLine, left, contentWidth);
    line(doc, "Αρ. κυκλοφορίας", data.vehicle?.plateNumber || "—", left, contentWidth);

    section("3. Χρόνος & τόπος");
    line(
      doc,
      "Παραλαβή",
      `${formatDateTime(data.pickupAt)}${
        data.pickupBranch ? ` · ${data.pickupBranch}` : ""
      }`,
      left,
      contentWidth
    );
    line(doc, "Επιστροφή", formatDateTime(data.returnAt), left, contentWidth);
    line(doc, "Διάρκεια", `${data.days} ημέρα/ες`, left, contentWidth);

    section("4. Τίμημα & εγγύηση");
    line(doc, "Ημερήσιο", formatCurrency(data.dailyRate), left, contentWidth);
    line(doc, "Σύνολο (με ΦΠΑ)", formatCurrency(data.totalAmount), left, contentWidth);
    line(doc, "ΦΠΑ", formatCurrency(data.vatAmount), left, contentWidth);
    line(doc, "Εγγύηση", formatCurrency(data.depositAmount), left, contentWidth);
    line(
      doc,
      "Καλύψεις",
      data.coverages.join(", ") || "Βασική αστική ευθύνη",
      left,
      contentWidth
    );

    section("5. Όροι χρήσης");
    const terms = [
      "Ο μισθωτής δηλώνει ότι κατέχει έγκυρη άδεια οδήγησης κατάλληλη για τον τύπο του οχήματος και ότι είναι σε θέση να το οδηγεί νόμιμα.",
      "Το όχημα παραδίδεται στην κατάσταση του ελέγχου παραλαβής (χιλιόμετρα, καύσιμο, ζημιές). Οφείλει να επιστραφεί στην ίδια κατάσταση, με την ίδια ποσότητα καυσίμου, εκτός αν συμφωνηθεί διαφορετικά.",
      "Απαγορεύεται η υπεκμίσθωση, η μεταφορά επιβατών/φορτίου έναντι αμοιβής, η συμμετοχή σε αγώνες, η οδήγηση υπό επήρεια αλκοόλ/ουσιών και η οδήγηση από μη δηλωμένους οδηγούς.",
      "Ο μισθωτής ευθύνεται για παραβάσεις Κ.Ο.Κ. και διοικητικά πρόστιμα κατά τη διάρκεια της μίσθωσης.",
      "Σε ατύχημα/ζημία ενημερώνει αμέσως την εταιρεία και τις αρμόδιες αρχές όπου απαιτείται· εφαρμόζονται οι συμφωνημένες καλύψεις και απαλλαγές.",
      "Η εταιρεία δύναται να καταγγείλει τη σύμβαση αν ο μισθωτής παραβιάζει ουσιωδώς τους όρους ή θέτει σε κίνδυνο το όχημα/τρίτους.",
      "Για φορολογικούς σκοπούς τηρείται Ψηφιακό Πελατολόγιο ΑΑΔΕ και εκδίδεται το προβλεπόμενο παραστατικό.",
    ];
    doc.font("Regular").fillColor("#0f1c2e").fontSize(8.5);
    for (const t of terms) {
      doc.text(`• ${t}`, left, doc.y, { width: contentWidth });
      doc.moveDown(0.2);
    }

    if (data.notes) {
      doc.moveDown(0.25);
      doc
        .font("Bold")
        .fontSize(10)
        .text("Ειδικές σημειώσεις: ", left, doc.y, {
          continued: true,
          width: contentWidth,
        });
      doc.font("Regular").text(data.notes);
    }

    doc.moveDown(0.4);
    doc
      .font("Regular")
      .fontSize(9)
      .text(
        "Ο μισθωτής δηλώνει ότι έλαβε αντίγραφο της παρούσας σύμβασης και του εντύπου ενημέρωσης προστασίας δεδομένων (GDPR) και συμφωνεί με τους ανωτέρω όρους.",
        { width: contentWidth }
      );

    doc.moveDown(1.8);
    const colW = (contentWidth - 40) / 2;
    const signY = doc.y;
    doc
      .moveTo(left, signY)
      .lineTo(left + colW, signY)
      .strokeColor("#0f1c2e")
      .stroke();
    doc
      .moveTo(left + colW + 40, signY)
      .lineTo(left + contentWidth, signY)
      .stroke();
    doc.moveDown(0.4);
    doc.font("Bold").fontSize(10).fillColor("#0f1c2e");
    const yAfter = doc.y;
    doc.text("Ο εκμισθωτής", left, yAfter, { width: colW });
    doc.text("Ο μισθωτής", left + colW + 40, yAfter, { width: colW });
    doc.font("Regular").fontSize(9);
    doc.text(data.orgName, left, yAfter + 14, { width: colW });
    const signer = data.agreement?.signerName || driver;
    doc.text(signer, left + colW + 40, yAfter + 14, { width: colW });
    doc
      .fillColor("#5a6b7d")
      .text("Ημερομηνία: ____ / ____ / ________", left, yAfter + 40, {
        width: colW,
      });
    if (data.agreement?.signedAt) {
      doc.text(
        `Υπογράφηκε ηλεκτρονικά: ${formatDateTime(data.agreement.signedAt)}`,
        left + colW + 40,
        yAfter + 40,
        { width: colW }
      );
    } else {
      doc.text("Υπογραφή: ________________", left + colW + 40, yAfter + 40, {
        width: colW,
      });
      doc.text(
        "Ημερομηνία: ____ / ____ / ________",
        left + colW + 40,
        yAfter + 54,
        { width: colW }
      );
    }

    doc.end();
  });
}
