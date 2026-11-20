import Link from "next/link";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  Card,
  EmptyState,
  PageHeader,
  buttonClass,
} from "@/components/ui";
import { BookingsList } from "@/components/bookings-list";
import { vehicleTypeLabel } from "@/lib/utils";

export default async function BookingsPage() {
  const session = await getSession();
  if (!session) return null;

  const bookings = await prisma.booking.findMany({
    where: { organizationId: session.organizationId },
    include: { customer: true, vehicle: true },
    orderBy: { pickupAt: "desc" },
    take: 50,
  });

  const rows = bookings.map((b) => ({
    id: b.id,
    code: b.code,
    status: b.status,
    paymentStatus: b.paymentStatus,
    aadeLedgerStatus: b.aadeLedgerStatus,
    totalAmount: b.totalAmount,
    pickupAt: b.pickupAt.toISOString(),
    customerName: `${b.customer.firstName} ${b.customer.lastName}`,
    vehicleLabel: b.vehicle
      ? `${b.vehicle.plateNumber} (${vehicleTypeLabel(b.vehicle.vehicleType)})`
      : null,
  }));

  return (
    <div>
      <PageHeader
        title="Κρατήσεις"
        description="Desk & online — παραλαβές, επιστροφές, ΑΑΔΕ"
        actions={
          <Link href="/bookings/new" className={buttonClass()}>
            Νέα κράτηση
          </Link>
        }
      />

      {bookings.length === 0 ? (
        <Card elevated padding="none">
          <EmptyState
            title="Δεν υπάρχουν κρατήσεις"
            description="Δημιούργησε την πρώτη κράτηση από το desk."
            action={
              <Link href="/bookings/new" className={buttonClass({ size: "sm" })}>
                Νέα κράτηση
              </Link>
            }
          />
        </Card>
      ) : (
        <BookingsList bookings={rows} />
      )}
    </div>
  );
}
