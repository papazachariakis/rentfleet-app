import Link from "next/link";
import { getSession } from "@/lib/session";
import { Badge, Card, PageHeader } from "@/components/ui";
import { buildOrgReports, defaultReportsRange } from "@/lib/reports";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const range = defaultReportsRange(days);
  const report = await buildOrgReports(session.organizationId, range);
  const { kpis } = report;

  return (
    <div>
      <PageHeader
        title="Αναφορές"
        description={`${formatDate(range.from)} – ${formatDate(range.to)}`}
        actions={
          <div className="flex gap-2 text-sm">
            {[7, 30, 90].map((d) => (
              <Link
                key={d}
                href={`/reports?days=${d}`}
                className={`rounded-lg px-3 py-1.5 ${
                  days === d
                    ? "bg-accent text-white"
                    : "border border-border hover:bg-slate-50"
                }`}
              >
                {d}η
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs font-medium uppercase text-muted">Έσοδα</p>
          <p className="mt-2 text-2xl font-semibold">
            {formatCurrency(kpis.revenue)}
          </p>
          <p className="text-xs text-muted">
            πληρωμένα {formatCurrency(kpis.paidRevenue)}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-muted">Κρατήσεις</p>
          <p className="mt-2 text-2xl font-semibold">{kpis.bookings}</p>
          <p className="text-xs text-muted">
            μ.ο. {formatCurrency(kpis.avgBookingValue)}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-muted">Utilization</p>
          <p className="mt-2 text-2xl font-semibold">{kpis.utilizationPct}%</p>
          <p className="text-xs text-muted">{kpis.fleetSize} οχήματα</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-muted">
            Συντήρηση / myDATA
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {formatCurrency(kpis.maintenanceCost)}
          </p>
          <p className="text-xs text-muted">
            {kpis.maintenanceCount} εργασίες · ΑΠΥ{" "}
            {formatCurrency(kpis.invoiceGross)}
          </p>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg">Ανά κανάλι</h2>
          {report.byChannel.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Χωρίς δεδομένα.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border text-sm">
              {report.byChannel.map((c) => (
                <li
                  key={c.channel}
                  className="flex items-center justify-between py-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge tone="accent">{c.channel}</Badge>
                    <span className="text-muted">{c.count} κρατήσεις</span>
                  </div>
                  <span className="font-medium">
                    {formatCurrency(c.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-lg">Top οχήματα</h2>
          {report.topVehicles.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Χωρίς δεδομένα.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border text-sm">
              {report.topVehicles.map((v) => (
                <li
                  key={v.plate}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <div>
                    <p className="font-medium">{v.plate}</p>
                    <p className="text-xs text-muted">
                      {v.label} · {v.days}η · {v.count} κρατ.
                    </p>
                  </div>
                  <span className="font-medium">
                    {formatCurrency(v.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
