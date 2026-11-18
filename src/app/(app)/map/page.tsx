import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { FleetMap } from "@/components/fleet-map";

export default async function MapPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div>
      <PageHeader
        title="Χάρτης στόλου"
        description="Θέσεις οχημάτων · κλικ για τοποθέτηση · GPS συσκευής"
      />
      <FleetMap />
    </div>
  );
}
