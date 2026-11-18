import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { BranchesManager } from "@/components/branches-manager";

export default async function BranchesPage() {
  const session = await getSession();
  if (!session) return null;

  const branches = await prisma.branch.findMany({
    where: { organizationId: session.organizationId },
    include: { _count: { select: { vehicles: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Καταστήματα"
        description="Κλαδιά / σημεία παραλαβής — κωδικός εγκατάστασης ΑΑΔΕ"
      />
      <BranchesManager initialBranches={branches} />
    </div>
  );
}
