import { buildAgreementHtml } from "@/lib/agreement-html";
import { buildGdprHtml } from "@/lib/gdpr-html";
import type { BookingDocPayload } from "@/lib/booking-documents";

/** Ενιαίο πακέτο εκτύπωσης: σύμβαση ενοικίασης + GDPR (2 σελίδες). */
export function buildPrintPackHtml(data: BookingDocPayload) {
  const agreement = buildAgreementHtml(data).replace(
    /<\/?html[^>]*>|<\/?head[\s\S]*?<\/head>|<\/?body[^>]*>/gi,
    ""
  );
  const gdpr = buildGdprHtml(data).replace(
    /<\/?html[^>]*>|<\/?head[\s\S]*?<\/head>|<\/?body[^>]*>/gi,
    ""
  );

  return `<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="utf-8" />
  <title>Πακέτο υπογραφής ${data.code || ""}</title>
  <style>
    @page { margin: 14mm; }
    body { font-family: Georgia, "Times New Roman", serif; color: #0f1c2e; }
    .toolbar { margin: 12px 0 20px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .toolbar button { padding: 10px 16px; border-radius: 8px; border: 0; cursor: pointer; font-size: 14px; }
    .primary { background: #1b6ca8; color: #fff; }
    .secondary { background: #fff; border: 1px solid #d5dde6 !important; }
    .page-break { page-break-before: always; break-before: page; margin-top: 24px; padding-top: 8px; border-top: 1px dashed #d5dde6; }
    @media print {
      .toolbar { display: none !important; }
      .page-break { border: 0; margin-top: 0; padding-top: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="primary" onclick="window.print()">Εκτύπωση σύμβασης + GDPR</button>
    <span style="color:#5a6b7d;font-size:13px">Κράτηση ${data.code || "—"} · για υπογραφή από τον πελάτη</span>
  </div>
  <section>${agreement}</section>
  <section class="page-break">${gdpr}</section>
  <script>window.addEventListener("load", function () { /* ready for print */ });</script>
</body>
</html>`;
}
