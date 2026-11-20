import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { PartnersManager } from "@/components/partners-manager";

export default async function PartnersPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div>
      <PageHeader
        title="Συμφωνίες / Partners"
        description="Broker & ξενοδοχεία με δικό τους τιμοκατάλογο και ιδιωτικό booking link"
      />
      <PartnersManager />
    </div>
  );
}
