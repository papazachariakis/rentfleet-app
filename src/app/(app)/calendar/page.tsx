import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { FleetCalendar } from "@/components/fleet-calendar";
import { BLOCKING_STATUSES } from "@/lib/bookings";

export default async function CalendarPage() {
  const session = await getSession();
  if (!session) return null;

  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 7);
  const to = new Date(now);
  to.setDate(to.getDate() + 45);

  const [vehicles, bookings] = await Promise.all([
    prisma.vehicle.findMany({
      where: { organizationId: session.organizationId, active: true },
      orderBy: { plateNumber: "asc" },
      select: {
        id: true,
        plateNumber: true,
        make: true,
        model: true,
        vehicleType: true,
        status: true,
      },
    }),
    prisma.booking.findMany({
      where: {
        organizationId: session.organizationId,
        status: { in: [...BLOCKING_STATUSES, "CHECKED_IN"] },
        pickupAt: { lt: to },
        returnAt: { gt: from },
      },
      select: {
        id: true,
        code: true,
        status: true,
        pickupAt: true,
        returnAt: true,
        vehicleId: true,
        customer: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Ημερολόγιο στόλου"
        description="Διαθεσιμότητα ανά όχημα — κλικ στη κράτηση για λεπτομέρειες"
      />
      <FleetCalendar
        vehicles={vehicles}
        bookings={bookings.map((b) => ({
          ...b,
          pickupAt: b.pickupAt.toISOString(),
          returnAt: b.returnAt.toISOString(),
        }))}
      />
    </div>
  );
}
