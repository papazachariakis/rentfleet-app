"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ImpersonationBanner({
  asName,
  asEmail,
  asOrg,
}: {
  asName: string;
  asEmail: string;
  asOrg: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function stop() {
    setLoading(true);
    const res = await fetch("/api/admin/stop-impersonate", { method: "POST" });
    setLoading(false);
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      router.push(data.redirectTo || "/admin");
      router.refresh();
    }
  }

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950">
      <div className="mx-auto flex max-w-[96rem] flex-wrap items-center justify-between gap-2">
        <p>
          <strong>Impersonation:</strong> είσαι μέσα ως {asName} ({asEmail}) ·{" "}
          {asOrg}
        </p>
        <button
          type="button"
          disabled={loading}
          onClick={stop}
          className="rounded-md bg-amber-900 px-3 py-1 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50"
        >
          {loading ? "…" : "Επιστροφή στο Admin"}
        </button>
      </div>
    </div>
  );
}
