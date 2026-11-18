import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { TeamManager } from "@/components/team-manager";

export default async function TeamPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div>
      <PageHeader
        title="Ομάδα"
        description="Πρόσθεσε υπαλλήλους γκισέ και διαχειριστές"
      />
      <TeamManager />
    </div>
  );
}
