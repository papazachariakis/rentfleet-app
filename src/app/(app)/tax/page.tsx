import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Badge, Card, PageHeader } from "@/components/ui";
import { TaxSettingsForm } from "@/components/tax-settings-form";
import { InvoiceRetryButton } from "@/components/invoice-retry-button";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default async function TaxPage() {
  const session = await getSession();
  if (!session) return null;

  const [org, invoices] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.organizationId },
    }),
    prisma.invoice.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { issuedAt: "desc" },
      take: 15,
      include: { booking: { select: { code: true } } },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="ΑΑΔΕ & myDATA"
        description="Ψηφιακό Πελατολόγιο + σύνδεση παροχού τιμολόγησης"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <TaxSettingsForm />

        <div className="space-y-4">
          <Card>
            <h2 className="font-display text-lg">Ροή συμμόρφωσης</h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-muted">
              <li>
                <strong className="text-foreground">Παραλαβή:</strong> Ψηφιακό
                Πελατολόγιο → μοναδικός αριθμός.
              </li>
              <li>
                <strong className="text-foreground">Επιστροφή:</strong>{" "}
                ώρα/τόπος + σύνδεση με παραστατικό.
              </li>
              <li>
                <strong className="text-foreground">Τιμολόγηση:</strong> ΑΠΥ
                μέσω παροχού ({org?.invoiceProvider || "AADE"}) στο check-in
                (mode: {org?.taxMode || "offline"}).
              </li>
            </ol>
            <p className="mt-4 text-xs text-muted">
              Πάροχος: {org?.invoiceProvider || "AADE"} · Επόμενο ΑΑ:{" "}
              {org?.invoiceSeries}-{org?.nextInvoiceAa} · ΦΠΑ{" "}
              {org?.vatCategory === 1 ? "24%" : org?.vatCategory}
            </p>
          </Card>

          <Card>
            <h2 className="font-display text-lg">Τελευταία παραστατικά</h2>
            {invoices.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                Κανένα ακόμα — εκδίδονται στην επιστροφή οχήματος.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border text-sm">
                {invoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <div>
                      <p className="font-medium">
                        {inv.number} · {inv.customerName}
                      </p>
                      <p className="text-xs text-muted">
                        {inv.booking?.code || "—"} ·{" "}
                        {formatDateTime(inv.issuedAt)}
                        {inv.mydataMark ? ` · MARK ${inv.mydataMark}` : ""}
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
                    <div className="flex flex-col items-end gap-1 text-right">
                      <p>{formatCurrency(inv.amount)}</p>
                      <Badge
                        tone={
                          inv.mydataStatus === "FAILED"
                            ? "danger"
                            : inv.mydataStatus === "SENT" ||
                                inv.mydataStatus === "OFFLINE"
                              ? "success"
                              : "neutral"
                        }
                      >
                        {inv.mydataStatus}
                      </Badge>
                      {inv.mydataStatus === "FAILED" ? (
                        <InvoiceRetryButton invoiceId={inv.id} />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
