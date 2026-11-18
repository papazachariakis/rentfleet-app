import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { CustomersManager } from "@/components/customers-manager";

export default async function CustomersPage() {
  const session = await getSession();
  if (!session) return null;

  const customers = await prisma.customer.findMany({
    where: { organizationId: session.organizationId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 200,
  });

  return (
    <div>
      <PageHeader
        title="Πελάτες"
        description="Οδηγοί, δίπλωμα, ΑΦΜ / διαβατήριο"
      />
      <CustomersManager initialCustomers={customers} />
    </div>
  );
}
