import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { appOrigin } from "@/lib/stripe";
import { buildAgreementPdf } from "@/lib/agreement-pdf";
import { loadBookingDocPayload } from "@/lib/booking-documents";

async function sendViaResend(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: { filename: string; content: string }[];
}) {
  const key = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM || "RentFleet <onboarding@resend.dev>";
  if (!key) return { ok: false as const, reason: "NO_RESEND_KEY" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
  }
  return { ok: true as const };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Email επιβεβαίωσης κράτησης στον πελάτη (Resend HTML + προαιρετικό PDF). */
export async function sendBookingConfirmationEmail(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: true,
      vehicle: true,
      organization: true,
      pickupBranch: true,
      agreement: true,
      extras: { include: { extra: true } },
    },
  });
  if (!booking) return { ok: false as const, reason: "NOT_FOUND" };
  if (booking.confirmationNotifiedAt) {
    return { ok: true as const, skipped: true as const };
  }
  const email = booking.customer.email;
  if (!email) return { ok: false as const, reason: "NO_EMAIL" };

  const licenseScan = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { licenseScanPdf: true, licenseScanCreatedAt: true },
  });

  const origin = appOrigin();
  const token = booking.organization.publicToken || "";
  const bookUrl = token ? `${origin}/book/${token}` : origin;
  const successUrl = token
    ? `${origin}/book/${token}/success?booking=${booking.id}`
    : origin;
  const agreementPublicUrl = token
    ? `${origin}/api/public/booking/${booking.id}/agreement-pdf?token=${encodeURIComponent(token)}`
    : "";
  const licensePublicUrl =
    token && licenseScan?.licenseScanCreatedAt
      ? `${origin}/api/public/booking/${booking.id}/license-scan?token=${encodeURIComponent(token)}`
      : "";

  const vehicleLabel = booking.vehicle
    ? `${booking.vehicle.make} ${booking.vehicle.model} (${booking.vehicle.plateNumber})`
    : "θα οριστεί";

  const extrasLines = booking.extras
    .map((e) => `  - ${e.extra.name} ×${e.quantity}: ${formatCurrency(e.total)}`)
    .join("\n");

  const extrasHtml = booking.extras.length
    ? `<ul style="margin:8px 0;padding-left:18px">${booking.extras
        .map(
          (e) =>
            `<li>${escapeHtml(e.extra.name)} ×${e.quantity}: ${formatCurrency(e.total)}</li>`
        )
        .join("")}</ul>`
    : "";

  const text = [
    `Γεια σου ${booking.customer.firstName},`,
    ``,
    `Η κράτησή σου στο ${booking.organization.name} καταχωρήθηκε.`,
    ``,
    `Κωδικός: ${booking.code || booking.id}`,
    `Όχημα: ${vehicleLabel}`,
    `Παραλαβή: ${formatDateTime(booking.pickupAt)}${
      booking.pickupBranch ? ` · ${booking.pickupBranch.name}` : ""
    }`,
    `Επιστροφή: ${formatDateTime(booking.returnAt)}`,
    `Ημέρες: ${booking.days}`,
    `Σύνολο: ${formatCurrency(booking.totalAmount)} (${booking.paymentStatus})`,
    `Εγγύηση: ${formatCurrency(booking.depositAmount)}`,
    extrasLines ? `Extras:\n${extrasLines}` : "",
    ``,
    `Τα έγγραφά σου: ${successUrl}`,
    agreementPublicUrl ? `Μισθωτήριο PDF: ${agreementPublicUrl}` : "",
    licensePublicUrl ? `Άδεια PDF: ${licensePublicUrl}` : "",
    `Online: ${bookUrl}`,
    ``,
    `Ευχαριστούμε,`,
    booking.organization.name,
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="el"><body style="font-family:Georgia,serif;color:#0f1c2e;line-height:1.5;max-width:560px;margin:0 auto;padding:24px">
  <h1 style="font-size:20px;margin:0 0 8px">Επιβεβαίωση κράτησης</h1>
  <p style="color:#5a6b7d;margin:0 0 16px">${escapeHtml(booking.organization.name)}</p>
  <p>Γεια σου ${escapeHtml(booking.customer.firstName)},</p>
  <p>Η κράτησή σου καταχωρήθηκε.</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
    <tr><td style="padding:6px 0;color:#5a6b7d">Κωδικός</td><td style="padding:6px 0;text-align:right"><strong>${escapeHtml(booking.code || booking.id)}</strong></td></tr>
    <tr><td style="padding:6px 0;color:#5a6b7d">Όχημα</td><td style="padding:6px 0;text-align:right">${escapeHtml(vehicleLabel)}</td></tr>
    <tr><td style="padding:6px 0;color:#5a6b7d">Παραλαβή</td><td style="padding:6px 0;text-align:right">${escapeHtml(formatDateTime(booking.pickupAt))}${booking.pickupBranch ? ` · ${escapeHtml(booking.pickupBranch.name)}` : ""}</td></tr>
    <tr><td style="padding:6px 0;color:#5a6b7d">Επιστροφή</td><td style="padding:6px 0;text-align:right">${escapeHtml(formatDateTime(booking.returnAt))}</td></tr>
    <tr><td style="padding:6px 0;color:#5a6b7d">Σύνολο</td><td style="padding:6px 0;text-align:right"><strong>${formatCurrency(booking.totalAmount)}</strong> (${escapeHtml(booking.paymentStatus)})</td></tr>
    <tr><td style="padding:6px 0;color:#5a6b7d">Εγγύηση</td><td style="padding:6px 0;text-align:right">${formatCurrency(booking.depositAmount)}</td></tr>
  </table>
  ${extrasHtml}
  <p style="margin-top:20px;font-size:14px"><strong>Τα έγγραφά σου</strong></p>
  <p style="margin:8px 0">
    <a href="${escapeHtml(successUrl)}" style="color:#1b6ca8">Άνοιγμα στη σελίδα κράτησης</a>
    ${agreementPublicUrl ? ` · <a href="${escapeHtml(agreementPublicUrl)}" style="color:#1b6ca8">Μισθωτήριο PDF</a>` : ""}
    ${licensePublicUrl ? ` · <a href="${escapeHtml(licensePublicUrl)}" style="color:#1b6ca8">Άδεια PDF</a>` : ""}
  </p>
  <p style="margin-top:24px"><a href="${escapeHtml(bookUrl)}" style="color:#1b6ca8">Online booking</a></p>
  <p style="color:#5a6b7d;font-size:13px">Ευχαριστούμε,<br/>${escapeHtml(booking.organization.name)}</p>
</body></html>`;

  let attachments: { filename: string; content: string }[] | undefined;
  try {
    const payload = await loadBookingDocPayload(booking.id);
    if (payload) {
      const pdf = await buildAgreementPdf(payload);
      attachments = [
        {
          filename: `misthotirio-${booking.code || booking.id}.pdf`,
          content: pdf.toString("base64"),
        },
      ];
      if (licenseScan?.licenseScanPdf) {
        attachments.push({
          filename: `adeia-${booking.code || booking.id}.pdf`,
          content: Buffer.from(licenseScan.licenseScanPdf).toString("base64"),
        });
      }
    }
  } catch (e) {
    console.error("agreement pdf attach", e);
  }

  try {
    const sent = await sendViaResend({
      to: email,
      subject: `Επιβεβαίωση κράτησης ${booking.code || ""} · ${booking.organization.name}`,
      text,
      html,
      attachments,
    });
    if (!sent.ok) return sent;

    await prisma.booking.update({
      where: { id: booking.id },
      data: { confirmationNotifiedAt: new Date() },
    });
    return { ok: true as const };
  } catch (e) {
    console.error("booking email", e);
    return {
      ok: false as const,
      reason: e instanceof Error ? e.message : "SEND_FAILED",
    };
  }
}
