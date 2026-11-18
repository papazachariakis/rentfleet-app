import { prisma } from "@/lib/prisma";

export type ComplianceAlert = {
  vehicleId: string;
  plateNumber: string;
  make: string;
  model: string;
  kind: "INSURANCE" | "KTEO" | "MECHANICAL" | "MAINTENANCE_DUE";
  label: string;
  dueAt: Date;
  daysLeft: number;
  severity: "overdue" | "soon" | "ok";
};

function daysBetween(a: Date, b: Date) {
  return Math.ceil((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

/** Λήξεις ασφάλειας / ΚΤΕΟ / μηχανολογικού + nextDue από logs */
export async function getComplianceAlerts(
  organizationId: string,
  withinDays = 30
): Promise<ComplianceAlert[]> {
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + withinDays);

  const vehicles = await prisma.vehicle.findMany({
    where: { organizationId, active: true },
    select: {
      id: true,
      plateNumber: true,
      make: true,
      model: true,
      insuranceExpiry: true,
      kteoExpiry: true,
      mechanicalExpiry: true,
      maintenanceLogs: {
        where: { nextDueAt: { not: null } },
        orderBy: { nextDueAt: "asc" },
        take: 1,
        select: { nextDueAt: true, title: true },
      },
    },
  });

  const alerts: ComplianceAlert[] = [];

  const push = (
    v: (typeof vehicles)[0],
    kind: ComplianceAlert["kind"],
    label: string,
    dueAt: Date | null | undefined
  ) => {
    if (!dueAt) return;
    const daysLeft = daysBetween(dueAt, now);
    if (daysLeft > withinDays) return;
    alerts.push({
      vehicleId: v.id,
      plateNumber: v.plateNumber,
      make: v.make,
      model: v.model,
      kind,
      label,
      dueAt,
      daysLeft,
      severity: daysLeft < 0 ? "overdue" : daysLeft <= 14 ? "soon" : "ok",
    });
  };

  for (const v of vehicles) {
    push(v, "INSURANCE", "Ασφάλεια", v.insuranceExpiry);
    push(v, "KTEO", "ΚΤΕΟ", v.kteoExpiry);
    push(v, "MECHANICAL", "Μηχανολογικός", v.mechanicalExpiry);
    const next = v.maintenanceLogs[0];
    if (next?.nextDueAt) {
      push(
        v,
        "MAINTENANCE_DUE",
        next.title || "Service",
        next.nextDueAt
      );
    }
  }

  alerts.sort((a, b) => a.daysLeft - b.daysLeft);
  return alerts;
}
