import { PageHeader } from "@/components/ui";
import { PricingManager } from "@/components/pricing-manager";

export default function PricingPage() {
  return (
    <div>
      <PageHeader
        title="Τιμολόγηση"
        description="Δυναμικές τιμές ανά περίοδο/ΣΚ και extras"
      />
      <PricingManager />
    </div>
  );
}
