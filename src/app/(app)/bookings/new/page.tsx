import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { NewBookingForm } from "@/components/new-booking-form";

export default function NewBookingPage() {
  return (
    <div>
      <PageHeader
        title="Νέα κράτηση"
        description="Desk booking — πελάτης, όχημα, καλύψεις"
        actions={
          <Link href="/bookings" className="text-sm text-accent hover:underline">
            ← Πίσω
          </Link>
        }
      />
      <NewBookingForm />
    </div>
  );
}
