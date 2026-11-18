import PDFDocument from "pdfkit";
import path from "path";
import { formatDateTime } from "@/lib/utils";
import type { BookingDocPayload } from "@/lib/booking-documents";

function fontPath(file: string) {
  return path.join(process.cwd(), "assets", "fonts", file);
}

/** Έντυπο ενημέρωσης GDPR (άρ. 13) + βεβαίωση παραλαβής — όχι εξαναγκασμένη συγκατάθεση. */
export async function buildGdprPdf(data: BookingDocPayload): Promise<Buffer> {
  const driver = `${data.customer.firstName} ${data.customer.lastName}`;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `GDPR ${data.code || ""}`,
        Author: data.orgName,
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("Regular", fontPath("DejaVuSans.ttf"));
    doc.registerFont("Bold", fontPath("DejaVuSans-Bold.ttf"));
    doc.font("Regular");

    const contentWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;

    doc
      .font("Bold")
      .fontSize(15)
      .fillColor("#0f1c2e")
      .text(
        "Έντυπο ενημέρωσης προστασίας δεδομένων προσωπικού χαρακτήρα (GDPR)",
        left,
        doc.y,
        { width: contentWidth }
      );
    doc.moveDown(0.35);
    doc
      .font("Regular")
      .fontSize(9)
      .fillColor("#5a6b7d")
      .text(
        `${data.orgName}${data.orgAfm ? ` · ΑΦΜ ${data.orgAfm}` : ""}${
          data.orgDoy ? ` · ΔΟΥ ${data.orgDoy}` : ""
        }`,
        { width: contentWidth }
      );
    doc
      .fillColor("#0f1c2e")
      .text(
        `Κράτηση: ${data.code || "—"} · Έκδοση: ${formatDateTime(new Date())} · Έκδοση εντύπου v${
          data.agreement?.gdprVersion || "1.0"
        }`,
        { width: contentWidth }
      );
    doc.moveDown(0.8);

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
      doc.font("Regular").fontSize(9).fillColor("#0f1c2e");
    };

    section("1. Υπεύθυνος επεξεργασίας");
    doc.text(
      `Υπεύθυνος επεξεργασίας είναι η επιχείρηση «${data.orgName}»${
        data.orgAfm ? ` (ΑΦΜ ${data.orgAfm})` : ""
      }. Τα δεδομένα συλλέγονται στο πλαίσιο της σύμβασης ενοικίασης οχήματος.`,
      { width: contentWidth }
    );

    section("2. Δεδομένα που τηρούνται");
    for (const t of [
      "Στοιχεία ταυτότητας / διαβατηρίου και επικοινωνίας (όνομα, τηλέφωνο, email).",
      "ΑΦΜ (όπου απαιτείται) και αριθμός άδειας οδήγησης / κατηγορίες.",
      "Στοιχεία κράτησης, οχήματος, παραλαβής/επιστροφής και οικονομικά στοιχεία.",
      "Αντίγραφο / σάρωση άδειας οδήγησης (PDF) για όσο διαρκεί η ενοικίαση και έως την επιστροφή.",
      "Φωτογραφίες ελέγχου παραλαβής/επιστροφής και σημειώσεις ζημιών (αν υπάρχουν).",
    ]) {
      doc.text(`• ${t}`, { width: contentWidth });
      doc.moveDown(0.2);
    }

    section("3. Σκοποί & νομική βάση");
    for (const t of [
      "Εκτέλεση σύμβασης ενοικίασης και παροχή υπηρεσιών (άρ. 6 παρ. 1β GDPR).",
      "Συμμόρφωση με νομικές υποχρεώσεις (φορολογία, ΑΑΔΕ / myDATA, πελατολόγιο) (άρ. 6 παρ. 1γ).",
      "Έννομο συμφέρον προστασίας περιουσίας / αποτροπής απάτης (άρ. 6 παρ. 1στ), όπου εφαρμόζεται.",
      "Συγκατάθεση για επικοινωνία marketing μόνο αν δοθεί χωριστά (όχι υποχρεωτική για την ενοικίαση).",
    ]) {
      doc.text(`• ${t}`, { width: contentWidth });
      doc.moveDown(0.2);
    }

    section("4. Χρόνος τήρησης");
    doc.text(
      "Τα δεδομένα τηρούνται για όσο απαιτείται από τη σύμβαση και τη φορολογική/λογιστική νομοθεσία. Η σάρωση άδειας διαγράφεται μετά την ολοκλήρωση επιστροφής του οχήματος, εκτός αν υπάρχει νόμιμος λόγος διατήρησης (π.χ. εκκρεμής αξίωση).",
      { width: contentWidth }
    );

    section("5. Αποδέκτες");
    doc.text(
      "Δεδομένα μπορεί να διαβιβαστούν σε αρμόδιες αρχές (ΑΑΔΕ), πάροχο ηλεκτρονικής τιμολόγησης, επεξεργαστή πληρωμών (π.χ. Stripe) και συνεργάτες φιλοξενίας/υποστήριξης IT, μόνο όσο είναι απαραίτητο.",
      { width: contentWidth }
    );

    section("6. Δικαιώματα");
    doc.text(
      "Έχετε δικαίωμα πρόσβασης, διόρθωσης, διαγραφής (όπου επιτρέπεται), περιορισμού, φορητότητας και εναντίωσης, καθώς και καταγγελίας στην Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα (www.dpa.gr).",
      { width: contentWidth }
    );

    section("7. Βεβαίωση παραλαβής ενημέρωσης");
    doc.text(
      `Ο/Η κάτωθι υπογεγραμμένος/η ${driver} δηλώνει ότι έλαβε την ανωτέρω ενημέρωση πριν ή κατά τη σύναψη της σύμβασης ενοικίασης και ότι τα στοιχεία που δήλωσε είναι αληθή.`,
      { width: contentWidth }
    );
    doc.moveDown(0.35);
    doc.text(
      "☐  Επιθυμώ προαιρετικά να λαμβάνω ενημερώσεις / προσφορές (μπορώ να ανακαλέσω ανά πάσα στιγμή).",
      { width: contentWidth }
    );

    doc.moveDown(1.6);
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
    doc.font("Bold").fontSize(10);
    const yAfter = doc.y;
    doc.text("Για την εταιρεία", left, yAfter, { width: colW });
    doc.text("Ο μισθωτής (υπογραφή)", left + colW + 40, yAfter, {
      width: colW,
    });
    doc.font("Regular").fontSize(9);
    doc.text(data.orgName, left, yAfter + 14, { width: colW });
    doc.text(
      data.agreement?.gdprSignerName || driver,
      left + colW + 40,
      yAfter + 14,
      { width: colW }
    );
    doc.text(`Ημερομηνία: ____ / ____ / ________`, left, yAfter + 40, {
      width: colW,
    });
    doc.text(
      data.agreement?.gdprSignedAt
        ? `Υπογράφηκε: ${formatDateTime(data.agreement.gdprSignedAt)}`
        : `Ημερομηνία: ____ / ____ / ________`,
      left + colW + 40,
      yAfter + 40,
      { width: colW }
    );

    doc.end();
  });
}
