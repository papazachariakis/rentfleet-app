import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { FleetManager } from "@/components/fleet-manager";

export default async function FleetPage() {
  const session = await getSession();
  if (!session) return null;

  const vehicles = await prisma.vehicle.findMany({
    where: { organizationId: session.organizationId },
    include: { category: true, branch: true },
    orderBy: [{ active: "desc" }, { plateNumber: "asc" }],
  });

  return (
    <div>
      <PageHeader
        title="Στόλος"
        description="Οχήματα, κατηγορίες, ΚΤΕΟ / ασφάλειες"
      />
      <FleetManager initialVehicles={vehicles} />
    </div>
  );
}
