import { loadBookingDocPayload } from "../src/lib/booking-documents";
import { buildAgreementPdf } from "../src/lib/agreement-pdf";
import fs from "fs";

const id = process.argv[2] || "cmwmlys4v000fl5086hukvb1k";
const payload = await loadBookingDocPayload(id);
if (!payload) {
  console.error("NOT_FOUND");
  process.exit(1);
}
console.log(
  JSON.stringify(
    {
      code: payload.code,
      org: payload.orgName,
      customer: `${payload.customer.firstName} ${payload.customer.lastName}`,
      vehicle: payload.vehicle?.plateNumber,
      pickupAt: payload.pickupAt,
      returnAt: payload.returnAt,
      days: payload.days,
      total: payload.totalAmount,
      agreement: payload.agreement,
    },
    null,
    2
  )
);
try {
  const pdf = await buildAgreementPdf(payload);
  fs.writeFileSync("tmp-agree.pdf", pdf);
  console.log("pdf_bytes", pdf.length, "header", pdf.subarray(0, 5).toString());
} catch (e) {
  console.error("PDF_ERROR", e);
  process.exit(1);
}
