import PDFDocument from "pdfkit";

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const m = dataUrl.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i);
  if (!m) return null;
  try {
    return Buffer.from(m[2], "base64");
  } catch {
    return null;
  }
}

/** Δημιουργεί PDF με μπροστά (+ προαιρετικά πίσω) όψη διπλώματος. */
export async function buildLicenseScanPdf(input: {
  frontImageDataUrl: string;
  backImageDataUrl?: string | null;
  bookingCode?: string | null;
  customerName?: string | null;
}): Promise<Buffer> {
  const front = dataUrlToBuffer(input.frontImageDataUrl);
  if (!front) throw new Error("INVALID_FRONT_IMAGE");
  const back = input.backImageDataUrl
    ? dataUrlToBuffer(input.backImageDataUrl)
    : null;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      info: {
        Title: `Δίπλωμα ${input.bookingCode || ""}`.trim(),
        Author: "RentFleet",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(14).text("Σάρωση άδειας οδήγησης", { align: "left" });
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor("#555");
    if (input.bookingCode) doc.text(`Κράτηση: ${input.bookingCode}`);
    if (input.customerName) doc.text(`Οδηγός: ${input.customerName}`);
    doc.text(`Ημ/νία αρχείου: ${new Date().toISOString()}`);
    doc.text(
      "Το αρχείο διατηρείται μέχρι την ολοκλήρωση επιστροφής του οχήματος."
    );
    doc.fillColor("#000");
    doc.moveDown(0.6);

    const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const maxH = doc.page.height - doc.page.margins.top - doc.page.margins.bottom - 80;

    doc.fontSize(11).text("Μπροστινή όψη");
    doc.moveDown(0.3);
    try {
      doc.image(front, {
        fit: [pageW, maxH * 0.42],
        align: "center",
      });
    } catch (e) {
      doc.fontSize(10).fillColor("red").text("Αποτυχία ενσωμάτωσης μπροστινής εικόνας");
      doc.fillColor("#000");
      console.error("license pdf front", e);
    }

    if (back) {
      doc.addPage();
      doc.fontSize(11).text("Πίσω όψη");
      doc.moveDown(0.3);
      try {
        doc.image(back, {
          fit: [pageW, maxH * 0.85],
          align: "center",
        });
      } catch (e) {
        doc.fontSize(10).fillColor("red").text("Αποτυχία ενσωμάτωσης πίσω εικόνας");
        doc.fillColor("#000");
        console.error("license pdf back", e);
      }
    }

    doc.end();
  });
}
