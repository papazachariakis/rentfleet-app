import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { BrandingManager } from "@/components/branding-manager";

export default async function BrandingPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div>
      <PageHeader
        title="White-label"
        description="Χρώματα, logo και κείμενα στο δημόσιο booking"
      />
      <BrandingManager />
    </div>
  );
}
