import { prisma } from "@/lib/prisma";

export type ReportsRange = {
  from: Date;
  to: Date;
};

export async function buildOrgReports(
  organizationId: string,
  range: ReportsRange
) {
  const { from, to } = range;
  const rangeMs = Math.max(1, to.getTime() - from.getTime());
  const rangeDays = rangeMs / (1000 * 60 * 60 * 24);

  const [bookings, vehicles, invoices, maintenanceCost] = await Promise.all([
    prisma.booking.findMany({
      where: {
        organizationId,
        status: { notIn: ["CANCELLED", "NO_SHOW", "DRAFT"] },
        pickupAt: { lt: to },
        returnAt: { gt: from },
      },
      select: {
        id: true,
        code: true,
        channel: true,
        status: true,
        pickupAt: true,
        returnAt: true,
        totalAmount: true,
        paymentStatus: true,
        vehicleId: true,
        vehicle: {
          select: { plateNumber: true, make: true, model: true },
        },
      },
    }),
    prisma.vehicle.findMany({
      where: { organizationId, active: true },
      select: {
        id: true,
        plateNumber: true,
        make: true,
        model: true,
        status: true,
      },
    }),
    prisma.invoice.findMany({
      where: {
        organizationId,
        issuedAt: { gte: from, lt: to },
        mydataStatus: { in: ["SENT", "OFFLINE"] },
      },
      select: { amount: true, vat: true },
    }),
    prisma.maintenanceLog.aggregate({
      where: {
        organizationId,
        performedAt: { gte: from, lt: to },
      },
      _sum: { cost: true },
      _count: true,
    }),
  ]);

  const startedInRange = bookings.filter(
    (b) => b.pickupAt >= from && b.pickupAt < to
  );

  const revenueBookings = startedInRange.reduce(
    (s, b) => s + b.totalAmount,
    0
  );
  const paidRevenue = startedInRange
    .filter(
      (b) => b.paymentStatus === "PAID" || b.paymentStatus === "PARTIAL"
    )
    .reduce((s, b) => s + b.totalAmount, 0);

  const invoiceGross = invoices.reduce((s, i) => s + i.amount, 0);

  const byChannel: Record<string, { count: number; revenue: number }> = {};
  for (const b of startedInRange) {
    const ch = b.channel || "DESK";
    if (!byChannel[ch]) byChannel[ch] = { count: 0, revenue: 0 };
    byChannel[ch].count += 1;
    byChannel[ch].revenue += b.totalAmount;
  }

  let rentedVehicleDays = 0;
  const perVehicle: Record<
    string,
    {
      plate: string;
      label: string;
      days: number;
      revenue: number;
      count: number;
    }
  > = {};

  for (const v of vehicles) {
    perVehicle[v.id] = {
      plate: v.plateNumber,
      label: `${v.make} ${v.model}`,
      days: 0,
      revenue: 0,
      count: 0,
    };
  }

  for (const b of bookings) {
    if (!b.vehicleId) continue;
    const start = Math.max(b.pickupAt.getTime(), from.getTime());
    const end = Math.min(b.returnAt.getTime(), to.getTime());
    if (end <= start) continue;
    const days = (end - start) / (1000 * 60 * 60 * 24);
    rentedVehicleDays += days;
    if (!perVehicle[b.vehicleId]) {
      perVehicle[b.vehicleId] = {
        plate: b.vehicle?.plateNumber || "—",
        label: b.vehicle
          ? `${b.vehicle.make} ${b.vehicle.model}`
          : "—",
        days: 0,
        revenue: 0,
        count: 0,
      };
    }
    perVehicle[b.vehicleId].days += days;
  }

  for (const b of startedInRange) {
    if (!b.vehicleId || !perVehicle[b.vehicleId]) continue;
    perVehicle[b.vehicleId].revenue += b.totalAmount;
    perVehicle[b.vehicleId].count += 1;
  }

  const capacityDays = Math.max(1, vehicles.length * rangeDays);
  const utilizationPct = Math.min(
    100,
    Math.round((rentedVehicleDays / capacityDays) * 1000) / 10
  );

  const topVehicles = Object.values(perVehicle)
    .filter((v) => v.count > 0 || v.days > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  return {
    range: { from, to, days: Math.round(rangeDays * 10) / 10 },
    kpis: {
      bookings: startedInRange.length,
      revenue: Math.round(revenueBookings * 100) / 100,
      paidRevenue: Math.round(paidRevenue * 100) / 100,
      invoiceGross: Math.round(invoiceGross * 100) / 100,
      utilizationPct,
      fleetSize: vehicles.length,
      maintenanceCost:
        Math.round((maintenanceCost._sum.cost || 0) * 100) / 100,
      maintenanceCount: maintenanceCost._count,
      avgBookingValue:
        startedInRange.length > 0
          ? Math.round((revenueBookings / startedInRange.length) * 100) / 100
          : 0,
    },
    byChannel: Object.entries(byChannel)
      .map(([channel, v]) => ({
        channel,
        count: v.count,
        revenue: Math.round(v.revenue * 100) / 100,
      }))
      .sort((a, b) => b.revenue - a.revenue),
    topVehicles: topVehicles.map((v) => ({
      ...v,
      days: Math.round(v.days * 10) / 10,
      revenue: Math.round(v.revenue * 100) / 100,
    })),
  };
}

export function defaultReportsRange(days = 30): ReportsRange {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}
