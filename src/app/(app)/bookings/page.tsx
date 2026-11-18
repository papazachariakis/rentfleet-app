import Link from "next/link";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  TBody,
  THead,
  Td,
  Th,
  buttonClass,
} from "@/components/ui";
import { formatCurrency, formatDateTime, vehicleTypeLabel } from "@/lib/utils";

export default async function BookingsPage() {
  const session = await getSession();
  if (!session) return null;

  const bookings = await prisma.booking.findMany({
    where: { organizationId: session.organizationId },
    include: { customer: true, vehicle: true },
    orderBy: { pickupAt: "desc" },
    take: 50,
  });

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
        <DataTable>
          <THead>
            <tr>
              <Th>Κωδικός</Th>
              <Th>Πελάτης</Th>
              <Th>Όχημα</Th>
              <Th>Παραλαβή</Th>
              <Th>Κατάσταση</Th>
              <Th>Πληρωμή</Th>
              <Th>ΑΑΔΕ</Th>
              <Th>Ποσό</Th>
            </tr>
          </THead>
          <TBody>
            {bookings.map((b) => (
              <tr key={b.id} className="transition hover:bg-slate-50/80">
                <Td className="font-medium">
                  <Link
                    href={`/bookings/${b.id}`}
                    className="text-accent hover:underline"
                  >
                    {b.code || "—"}
                  </Link>
                </Td>
                <Td>
                  {b.customer.firstName} {b.customer.lastName}
                </Td>
                <Td>
                  {b.vehicle
                    ? `${b.vehicle.plateNumber} (${vehicleTypeLabel(b.vehicle.vehicleType)})`
                    : "—"}
                </Td>
                <Td>{formatDateTime(b.pickupAt)}</Td>
                <Td>
                  <Badge tone="accent">{b.status}</Badge>
                </Td>
                <Td>
                  <Badge
                    tone={b.paymentStatus === "PAID" ? "success" : "warning"}
                  >
                    {b.paymentStatus}
                  </Badge>
                </Td>
                <Td>
                  <Badge
                    tone={
                      b.aadeLedgerStatus === "OK"
                        ? "success"
                        : b.aadeLedgerStatus === "FAILED"
                          ? "danger"
                          : "neutral"
                    }
                  >
                    {b.aadeLedgerStatus}
                  </Badge>
                </Td>
                <Td>{formatCurrency(b.totalAmount)}</Td>
              </tr>
            ))}
          </TBody>
        </DataTable>
      )}
    </div>
  );
}
