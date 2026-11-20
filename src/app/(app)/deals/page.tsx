import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { DealsManager } from "@/components/deals-manager";

export default async function DealsPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div>
      <PageHeader
        title="Προσφορές / Deals"
        description="Π.χ. 5 μέρες + 1 δωρεάν — εμφανίζονται στη δημόσια σελίδα κράτησης και ενημερώνουν αυτόματα την τιμή"
      />
      <DealsManager />
    </div>
  );
}
