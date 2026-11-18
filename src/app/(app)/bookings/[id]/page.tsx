import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Badge, Card, PageHeader } from "@/components/ui";
import { BookingOps } from "@/components/booking-ops";
import {
  formatCurrency,
  formatDateTime,
  vehicleTypeLabel,
} from "@/lib/utils";

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const { id } = await params;
  const [booking, vehicles] = await Promise.all([
    prisma.booking.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        customer: true,
        vehicle: true,
        pickupBranch: true,
        returnBranch: true,
        agreement: true,
        inspections: { orderBy: { inspectedAt: "desc" } },
        invoices: { orderBy: { issuedAt: "desc" } },
      },
    }),
    prisma.vehicle.findMany({
      where: { organizationId: session.organizationId, active: true },
      orderBy: { plateNumber: "asc" },
      select: { id: true, plateNumber: true, make: true, model: true },
    }),
  ]);

  if (!booking) notFound();

  const failedInvoice =
    booking.invoices.find((i) => i.mydataStatus === "FAILED") || null;

  const coverages: string[] = (() => {
    try {
      return JSON.parse(booking.coveragesJson || "[]");
    } catch {
      return [];
    }
  })();

  return (
    <div>
      <PageHeader
        title={booking.code || "Κράτηση"}
        description={`${booking.customer.firstName} ${booking.customer.lastName}`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={`/api/bookings/${booking.id}/print-pack`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-dark"
            >
              Εκτύπωση για υπογραφή
            </a>
            {booking.licenseScanCreatedAt ? (
              <a
                href={`/api/bookings/${booking.id}/license-scan`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-slate-50"
              >
                Άδεια PDF
              </a>
            ) : null}
            <Link href="/bookings" className="text-sm text-accent hover:underline">
              ← Κρατήσεις
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <h2 className="font-display text-lg">Έγγραφα πελάτη</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`/api/bookings/${booking.id}/print-pack`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-dark"
              >
                Εκτύπωση για υπογραφή
              </a>
              <a
                href={`/api/bookings/${booking.id}/agreement/pdf`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-slate-50"
              >
                Σύμβαση PDF
              </a>
              <a
                href={`/api/bookings/${booking.id}/gdpr/pdf`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-slate-50"
              >
                GDPR PDF
              </a>
              {booking.licenseScanCreatedAt ? (
                <a
                  href={`/api/bookings/${booking.id}/license-scan`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-slate-50"
                >
                  Άδεια PDF
                </a>
              ) : (
                <p className="text-xs text-muted self-center">
                  Δεν υπάρχει σάρωση άδειας
                </p>
              )}
            </div>
            {booking.licenseScanCreatedAt ? (
              <iframe
                title="Άδεια οδήγησης"
                src={`/api/bookings/${booking.id}/license-scan`}
                className="mt-3 h-64 w-full rounded-md border border-border bg-white"
              />
            ) : null}
          </Card>

          <Card>
            <h2 className="font-display text-lg">Στοιχεία</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Κατάσταση</dt>
                <dd>
                  <Badge tone="accent">{booking.status}</Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Κανάλι</dt>
                <dd>{booking.channel}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Όχημα</dt>
                <dd>
                  {booking.vehicle
                    ? `${booking.vehicle.plateNumber} · ${booking.vehicle.make} ${booking.vehicle.model} (${vehicleTypeLabel(booking.vehicle.vehicleType)})`
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Παραλαβή</dt>
                <dd>{formatDateTime(booking.pickupAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Επιστροφή</dt>
                <dd>{formatDateTime(booking.returnAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Ημέρες</dt>
                <dd>{booking.days}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Σύνολο</dt>
                <dd className="font-medium">
                  {formatCurrency(booking.totalAmount)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">ΦΠΑ</dt>
                <dd>{formatCurrency(booking.vatAmount)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Εγγύηση</dt>
                <dd>{formatCurrency(booking.depositAmount)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Πληρωμή</dt>
                <dd>
                  <Badge
                    tone={
                      booking.paymentStatus === "PAID" ? "success" : "warning"
                    }
                  >
                    {booking.paymentStatus}
                  </Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Καλύψεις</dt>
                <dd>{coverages.join(", ") || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Κατάστημα</dt>
                <dd>{booking.pickupBranch?.name || "—"}</dd>
              </div>
            </dl>
          </Card>

          {booking.inspections.length > 0 ? (
            <Card>
              <h2 className="font-display text-lg">Έλεγχοι</h2>
              <ul className="mt-3 divide-y divide-border text-sm">
                {booking.inspections.map((i) => (
                  <li key={i.id} className="space-y-2 py-3">
                    <p className="font-medium">
                      {i.kind === "PICKUP" ? "Παραλαβή" : "Επιστροφή"} ·{" "}
                      {formatDateTime(i.inspectedAt)}
                    </p>
                    <p className="text-muted">
                      {i.odometerKm != null ? `${i.odometerKm} km` : "—"} ·{" "}
                      {i.fuelLevel || "—"}
                      {i.damageNotes ? ` · ${i.damageNotes}` : ""}
                    </p>
                    {i.photos?.length ? (
                      <div className="grid grid-cols-3 gap-2">
                        {i.photos.map((src, idx) => (
                          <a
                            key={`${i.id}-${idx}`}
                            href={src}
                            target="_blank"
                            rel="noreferrer"
                            className="block overflow-hidden rounded-md border border-border bg-slate-50"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={src}
                              alt={`${i.kind} ${idx + 1}`}
                              className="aspect-square h-full w-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {booking.invoices.length > 0 ? (
            <Card>
              <h2 className="font-display text-lg">Παραστατικά myDATA</h2>
              <ul className="mt-3 divide-y divide-border text-sm">
                {booking.invoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <div>
                      <p className="font-medium">{inv.number}</p>
                      <p className="text-xs text-muted">
                        {formatDateTime(inv.issuedAt)}
                        {inv.mydataMark ? ` · MARK ${inv.mydataMark}` : ""}
                        {inv.mydataUid ? ` · ${inv.mydataUid}` : ""}
                      </p>
                      {inv.qrUrl ? (
                        <a
                          href={inv.qrUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-accent hover:underline"
                        >
                          QR / επαλήθευση
                        </a>
                      ) : null}
                      {inv.errorMessage ? (
                        <p className="text-xs text-danger">{inv.errorMessage}</p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p>{formatCurrency(inv.amount)}</p>
                      <Badge
                        tone={
                          inv.mydataStatus === "FAILED" ? "danger" : "success"
                        }
                      >
                        {inv.mydataStatus}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="lg:col-span-3">
          <BookingOps
            bookingId={booking.id}
            status={booking.status}
            aadeLedgerId={booking.aadeLedgerId}
            aadeLedgerStatus={booking.aadeLedgerStatus}
            mydataStatus={booking.mydataStatus}
            agreementSigned={Boolean(booking.agreement?.signedAt)}
            customerName={`${booking.customer.firstName} ${booking.customer.lastName}`}
            defaultOdometer={booking.vehicle?.odometerKm}
            defaultFuel={booking.vehicle?.fuelLevel}
            pickupAt={booking.pickupAt.toISOString()}
            returnAt={booking.returnAt.toISOString()}
            vehicleId={booking.vehicleId}
            vehicles={vehicles}
            failedInvoiceId={failedInvoice?.id}
          />
        </div>
      </div>
    </div>
  );
}
