import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
  buttonClass,
} from "@/components/ui";
import { formatCurrency, formatDateTime, vehicleTypeLabel } from "@/lib/utils";
import { getComplianceAlerts } from "@/lib/maintenance";
import { buildOrgReports, defaultReportsRange } from "@/lib/reports";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { Car, CalendarDays, FileText, AlertTriangle } from "lucide-react";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  if (
    isPlatformAdmin(session) &&
    !session.organizationId &&
    !session.impersonating
  ) {
    redirect("/admin");
  }

  const orgId = session.organizationId;
  const now = new Date();
  const in7 = new Date(now);
  in7.setDate(in7.getDate() + 7);

  const [vehicles, bookingsToday, pendingLedger, upcoming, org, alerts, month] =
    await Promise.all([
      prisma.vehicle.count({
        where: { organizationId: orgId, active: true },
      }),
      prisma.booking.count({
        where: {
          organizationId: orgId,
          pickupAt: {
            gte: new Date(now.toDateString()),
            lt: new Date(now.getTime() + 86400000),
          },
          status: { not: "CANCELLED" },
        },
      }),
      prisma.booking.count({
        where: {
          organizationId: orgId,
          aadeLedgerStatus: { in: ["PENDING", "FAILED"] },
          status: { in: ["CHECKED_OUT", "CHECKED_IN", "CONFIRMED"] },
        },
      }),
      prisma.booking.findMany({
        where: {
          organizationId: orgId,
          pickupAt: { gte: now, lte: in7 },
          status: { not: "CANCELLED" },
        },
        include: { customer: true, vehicle: true },
        orderBy: { pickupAt: "asc" },
        take: 8,
      }),
      prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          afm: true,
          taxMode: true,
          clientLedgerMode: true,
          stripeChargesEnabled: true,
          publicToken: true,
        },
      }),
      getComplianceAlerts(orgId, 14),
      buildOrgReports(orgId, defaultReportsRange(30)),
    ]);

  const available = await prisma.vehicle.count({
    where: { organizationId: orgId, active: true, status: "AVAILABLE" },
  });
  const overdueAlerts = alerts.filter((a) => a.severity === "overdue").length;

  return (
    <div>
      <PageHeader
        title={`Γεια σου, ${session.name.split(" ")[0] || "εκεί"}`}
        description="Σήμερα στο rent-a-car σου"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Car}
          label="Στόλος"
          value={`${available}/${vehicles}`}
          hint="διαθέσιμα / σύνολο"
        />
        <StatCard
          icon={CalendarDays}
          label="Παραλαβές σήμερα"
          value={bookingsToday}
        />
        <StatCard
          icon={FileText}
          label="ΑΑΔΕ εκκρεμή"
          value={pendingLedger}
          hint="πελατολόγιο"
        />
        <StatCard
          icon={AlertTriangle}
          label="30η έσοδα"
          value={formatCurrency(month.kpis.revenue)}
          hint={`util ${month.kpis.utilizationPct}% · λήξεις ${
            overdueAlerts > 0 ? `${overdueAlerts} overdue` : alerts.length || "OK"
          }`}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card elevated className="lg:col-span-2" padding="none">
          <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
            <h2 className="font-display text-lg text-ink">Επόμενες 7 ημέρες</h2>
            <Link
              href="/bookings"
              className="text-sm font-medium text-accent hover:underline"
            >
              Όλες
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState
              title="Δεν υπάρχουν κρατήσεις ακόμα"
              description="Δημιούργησε την πρώτη κράτηση από το desk."
              action={
                <Link href="/bookings/new" className={buttonClass({ size: "sm" })}>
                  Νέα κράτηση
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-border/80 px-5">
              {upcoming.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3.5 text-sm"
                >
                  <div>
                    <p className="font-medium text-ink">
                      {b.customer.firstName} {b.customer.lastName}
                    </p>
                    <p className="text-muted">
                      {b.vehicle
                        ? `${b.vehicle.plateNumber} · ${vehicleTypeLabel(b.vehicle.vehicleType)}`
                        : "Χωρίς όχημα"}{" "}
                      · {formatDateTime(b.pickupAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(b.totalAmount)}</p>
                    <Badge
                      tone={
                        b.paymentStatus === "PAID" ? "success" : "warning"
                      }
                    >
                      {b.paymentStatus}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card elevated>
          <h2 className="font-display text-lg text-ink">Γρήγορα</h2>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/setup"
              className="rounded-lg border border-accent/25 bg-accent-soft px-3 py-2.5 text-sm font-medium text-accent transition hover:bg-accent-soft/80"
            >
              Στήσιμο βήμα βήμα
            </Link>
            {[
              { href: "/bookings/new", label: "Νέα κράτηση (desk)" },
              { href: "/fleet", label: "Διαχείριση στόλου" },
              {
                href: "/maintenance",
                label: `Συντήρηση / λήξεις${alerts.length ? ` (${alerts.length})` : ""}`,
              },
              { href: "/reports", label: "Αναφορές KPI" },
              { href: "/tax", label: "ΑΑΔΕ & myDATA" },
              { href: "/payments", label: "Stripe keys" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg border border-border/80 px-3 py-2.5 text-sm transition hover:bg-slate-50"
              >
                {item.label}
              </Link>
            ))}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge tone={org?.afm ? "success" : "warning"}>
                ΑΦΜ {org?.afm ? "OK" : "λείπει"}
              </Badge>
              <Badge tone="accent">{org?.taxMode || "offline"}</Badge>
              <Badge tone={org?.stripeChargesEnabled ? "success" : "neutral"}>
                Stripe {org?.stripeChargesEnabled ? "ON" : "OFF"}
              </Badge>
            </div>
            {org?.publicToken ? (
              <Link
                href={`/book/${org.publicToken}`}
                className="rounded-lg border border-accent/25 bg-accent-soft px-3 py-2.5 text-sm font-medium text-accent transition hover:bg-accent-soft/80"
              >
                Δημόσιο booking
              </Link>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
