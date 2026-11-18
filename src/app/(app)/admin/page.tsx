import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { PageHeader } from "@/components/ui";
import { AdminTenants } from "@/components/admin-tenants";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isPlatformAdmin(session)) redirect("/dashboard");

  return (
    <div>
      <PageHeader
        title="Platform Admin"
        description="Όλοι οι οργανισμοί · σύνδεση στους λογαριασμούς τους"
      />
      <AdminTenants />
    </div>
  );
}
