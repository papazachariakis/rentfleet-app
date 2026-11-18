import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { ChannelsManager } from "@/components/channels-manager";

export default async function ChannelsPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div>
      <PageHeader
        title="Κανάλια / OTA"
        description="iCal sync, Booking/Airbnb import, αποφυγή double booking"
      />
      <ChannelsManager />
    </div>
  );
}
