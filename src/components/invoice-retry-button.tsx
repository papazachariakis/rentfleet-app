"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function InvoiceRetryButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function retry() {
    setLoading(true);
    setMsg("");
    const res = await fetch(`/api/tax/invoices/${invoiceId}/retry`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMsg(data.error || "Σφάλμα");
      return;
    }
    setMsg(data.skipped ? "Ήδη απεσταλμένο" : "Επανυποβολή OK");
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="secondary"
        className="px-2 py-1 text-xs"
        disabled={loading}
        onClick={retry}
      >
        Retry myDATA
      </Button>
      {msg ? <span className="text-[10px] text-muted">{msg}</span> : null}
    </span>
  );
}
