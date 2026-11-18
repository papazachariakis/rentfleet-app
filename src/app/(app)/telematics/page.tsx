import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { TelematicsManager } from "@/components/telematics-manager";

export default async function TelematicsPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div>
      <PageHeader
        title="Trackers οχημάτων"
        description="Θέση, καύσιμο, ταχύτητα, βλάβες · επίσημοι RentFleet trackers"
      />
      <TelematicsManager />
    </div>
  );
}
