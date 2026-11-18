import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { MaintenanceManager } from "@/components/maintenance-manager";
import { getComplianceAlerts } from "@/lib/maintenance";

export default async function MaintenancePage() {
  const session = await getSession();
  if (!session) return null;

  const [vehicles, logs, alerts] = await Promise.all([
    prisma.vehicle.findMany({
      where: { organizationId: session.organizationId, active: true },
      orderBy: { plateNumber: "asc" },
      select: { id: true, plateNumber: true, make: true, model: true },
    }),
    prisma.maintenanceLog.findMany({
      where: { organizationId: session.organizationId },
      include: {
        vehicle: {
          select: { plateNumber: true, make: true, model: true },
        },
      },
      orderBy: { performedAt: "desc" },
      take: 50,
    }),
    getComplianceAlerts(session.organizationId, 45),
  ]);

  return (
    <div>
      <PageHeader
        title="Συντήρηση στόλου"
        description="ΚΤΕΟ, ασφάλειες, service και ειδοποιήσεις λήξης"
      />
      <MaintenanceManager
        vehicles={vehicles}
        initialLogs={logs.map((l) => ({
          ...l,
          performedAt: l.performedAt.toISOString(),
          nextDueAt: l.nextDueAt?.toISOString() || null,
        }))}
        initialAlerts={alerts.map((a) => ({
          ...a,
          dueAt: a.dueAt.toISOString(),
        }))}
      />
    </div>
  );
}
