"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function ConfirmPaymentClient({
  bookingId,
  token,
  sessionId,
}: {
  bookingId: string;
  token: string;
  sessionId: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState("Επιβεβαίωση πληρωμής…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/public/booking/${bookingId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, token }),
      });
      if (cancelled) return;
      if (res.ok) {
        setStatus("Η πληρωμή επιβεβαιώθηκε.");
        router.refresh();
      } else {
        setStatus(
          "Η πληρωμή εκκρεμεί επιβεβαίωσης — θα ενημερωθεί αυτόματα σύντομα."
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId, token, sessionId, router]);

  return <p className="mt-4 text-sm text-muted">{status}</p>;
}
