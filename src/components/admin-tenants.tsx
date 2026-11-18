"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card } from "@/components/ui";
import { formatDate } from "@/lib/utils";

type Member = {
  membershipId: string;
  role: string;
  userId: string;
  email: string;
  name: string;
};

type Tenant = {
  id: string;
  name: string;
  afm: string | null;
  publicToken: string | null;
  taxMode: string;
  createdAt: string;
  counts: { vehicles: number; bookings: number; customers: number };
  members: Member[];
};

export function AdminTenants() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/tenants")
      .then((r) => r.json())
      .then((d) => setTenants(d.tenants || []))
      .catch(() => setMsg("Αποτυχία φόρτωσης"));
  }, []);

  async function impersonate(userId: string, organizationId: string) {
    setLoading(userId);
    setMsg("");
    const res = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, organizationId }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(null);
    if (!res.ok) {
      setMsg(data.error || "Αποτυχία σύνδεσης");
      return;
    }
    router.push(data.redirectTo || "/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {msg ? <p className="text-sm text-danger">{msg}</p> : null}
      {tenants.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">Δεν υπάρχουν οργανισμοί ακόμα.</p>
        </Card>
      ) : (
        tenants.map((t) => (
          <Card key={t.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg">{t.name}</h2>
                <p className="text-sm text-muted">
                  ΑΦΜ {t.afm || "—"} · {t.taxMode} ·{" "}
                  {formatDate(t.createdAt)}
                  {t.publicToken ? ` · /book/${t.publicToken}` : ""}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {t.counts.vehicles} οχήματα · {t.counts.bookings} κρατήσεις ·{" "}
                  {t.counts.customers} πελάτες
                </p>
              </div>
            </div>
            <ul className="mt-4 divide-y divide-border text-sm">
              {t.members.map((m) => (
                <li
                  key={m.membershipId}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div>
                    <p className="font-medium">{m.name}</p>
                    <p className="text-xs text-muted">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="accent">{m.role}</Badge>
                    <Button
                      type="button"
                      variant="secondary"
                      className="px-3 py-1.5 text-xs"
                      disabled={loading === m.userId}
                      onClick={() => impersonate(m.userId, t.id)}
                    >
                      {loading === m.userId ? "…" : "Σύνδεση ως"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}
