import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { BLOCKING_STATUSES } from "@/lib/bookings";
import { sortByCategoryName } from "@/lib/utils";

const UNAVAILABLE_STATUSES = new Set([
  "MAINTENANCE",
  "BLOCKED",
  "OUT_OF_SERVICE",
]);

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.organizationId;
  const { searchParams } = new URL(req.url);
  const pickupRaw = searchParams.get("pickupAt");
  const returnRaw = searchParams.get("returnAt");
  const pickupAt = pickupRaw ? new Date(pickupRaw) : null;
  const returnAt = returnRaw ? new Date(returnRaw) : null;
  const hasRange =
    pickupAt &&
    returnAt &&
    !Number.isNaN(pickupAt.getTime()) &&
    !Number.isNaN(returnAt.getTime()) &&
    pickupAt < returnAt;

  const [vehicles, customers, branches, extras, categories, busyBookings] =
    await Promise.all([
      prisma.vehicle.findMany({
        where: { organizationId: orgId, active: true },
        include: { category: true, branch: true },
        orderBy: { plateNumber: "asc" },
      }),
      prisma.customer.findMany({
        where: { organizationId: orgId, blacklisted: false },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        take: 200,
      }),
      prisma.branch.findMany({
        where: { organizationId: orgId, active: true },
        orderBy: { name: "asc" },
      }),
      prisma.extra.findMany({
        where: { organizationId: orgId, active: true },
        orderBy: { name: "asc" },
      }),
      prisma.vehicleCategory.findMany({
        where: { organizationId: orgId, active: true },
      }),
      hasRange
        ? prisma.booking.findMany({
            where: {
              organizationId: orgId,
              vehicleId: { not: null },
              status: { in: [...BLOCKING_STATUSES] },
              pickupAt: { lt: returnAt! },
              returnAt: { gt: pickupAt! },
            },
            select: { vehicleId: true, code: true },
          })
        : Promise.resolve([] as { vehicleId: string | null; code: string }[]),
    ]);

  const busyByVehicle = new Map<string, string>();
  for (const b of busyBookings) {
    if (b.vehicleId && !busyByVehicle.has(b.vehicleId)) {
      busyByVehicle.set(b.vehicleId, b.code || "κρατηση");
    }
  }

  const annotated = vehicles.map((v) => {
    const statusBlocked = UNAVAILABLE_STATUSES.has(v.status);
    const conflictCode = busyByVehicle.get(v.id) || null;
    const availableForDates = !statusBlocked && !conflictCode;
    return {
      ...v,
      availableForDates,
      conflictCode,
      availabilityLabel: statusBlocked
        ? v.status
        : conflictCode
          ? `ΝΟΙΚΙΑΣΜΕΝΟ (${conflictCode})`
          : "ΔΙΑΘΕΣΙΜΟ",
    };
  });

  return NextResponse.json({
    vehicles: annotated,
    customers,
    branches,
    extras,
    categories: sortByCategoryName(categories),
  });
}
