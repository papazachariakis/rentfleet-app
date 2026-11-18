import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { DashboardShell } from "@/components/dashboard-shell";
import { ImpersonationBanner } from "@/components/impersonation-banner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <>
      {session.impersonating ? (
        <ImpersonationBanner
          asName={session.name}
          asEmail={session.email}
          asOrg={session.organizationName}
        />
      ) : null}
      <DashboardShell
        userName={session.name}
        orgName={session.organizationName || "RentFleet"}
        platformAdmin={isPlatformAdmin(session)}
        impersonating={Boolean(session.impersonating)}
      >
        {children}
      </DashboardShell>
    </>
  );
}
