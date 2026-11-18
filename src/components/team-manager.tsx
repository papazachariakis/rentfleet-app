"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Input, Label } from "@/components/ui";
import { ROLE_LABELS, type OrgRole } from "@/lib/permissions";

type Member = {
  membershipId: string;
  role: string;
  userId: string;
  email: string;
  name: string;
  isYou: boolean;
};

export function TeamManager() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "DESK" as OrgRole,
  });

  async function load() {
    const res = await fetch("/api/team");
    if (!res.ok) return;
    const data = await res.json();
    setMembers(data.members || []);
    setCanManage(Boolean(data.canManage));
  }

  useEffect(() => {
    load();
  }, []);

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMsg(data.error || "Σφάλμα");
      return;
    }
    setMsg(data.linked ? "Προστέθηκε υπάρχων χρήστης" : "Μέλος δημιουργήθηκε");
    setForm({ name: "", email: "", password: "", role: "DESK" });
    load();
    router.refresh();
  }

  async function setRole(membershipId: string, role: OrgRole) {
    setLoading(true);
    const res = await fetch(`/api/team/${membershipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error || "Σφάλμα");
      return;
    }
    load();
  }

  async function remove(membershipId: string) {
    if (!confirm("Αφαίρεση μέλους από την ομάδα;")) return;
    setLoading(true);
    const res = await fetch(`/api/team/${membershipId}`, { method: "DELETE" });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error || "Σφάλμα");
      return;
    }
    load();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <h2 className="font-display text-lg">Νέο μέλος</h2>
        {!canManage ? (
          <p className="mt-3 text-sm text-muted">
            Μόνο διαχειριστής μπορεί να προσθέσει μέλη.
          </p>
        ) : (
          <form onSubmit={addMember} className="mt-4 space-y-3">
            <div>
              <Label>Ονοματεπώνυμο</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <Label>Email (login)</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <Label>Κωδικός</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                minLength={6}
                required
              />
            </div>
            <div>
              <Label>Ρόλος</Label>
              <select
                className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    role: e.target.value as OrgRole,
                  }))
                }
              >
                {(Object.keys(ROLE_LABELS) as OrgRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={loading}>
              Προσθήκη
            </Button>
            {msg ? <p className="text-sm text-muted">{msg}</p> : null}
          </form>
        )}
      </Card>

      <Card className="lg:col-span-3">
        <h2 className="font-display text-lg">Μέλη οργανισμού</h2>
        <ul className="mt-3 divide-y divide-border text-sm">
          {members.map((m) => (
            <li
              key={m.membershipId}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="font-medium">
                  {m.name}{" "}
                  {m.isYou ? (
                    <span className="text-xs text-muted">(εσύ)</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted">{m.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canManage && !m.isYou ? (
                  <select
                    className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs"
                    value={m.role}
                    disabled={loading}
                    onChange={(e) =>
                      setRole(m.membershipId, e.target.value as OrgRole)
                    }
                  >
                    {(Object.keys(ROLE_LABELS) as OrgRole[]).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge tone="accent">
                    {ROLE_LABELS[m.role as OrgRole] || m.role}
                  </Badge>
                )}
                {canManage && !m.isYou ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-2 py-1 text-xs text-danger"
                    disabled={loading}
                    onClick={() => remove(m.membershipId)}
                  >
                    Αφαίρεση
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-1 text-xs text-muted">
          <p>
            <strong>Διαχειριστής:</strong> ρυθμίσεις ΑΑΔΕ, Stripe, ομάδα, τιμές
          </p>
          <p>
            <strong>Γκισέ:</strong> κρατήσεις, στόλος, πελάτες, συντήρηση
          </p>
          <p>
            <strong>Μόνο ανάγνωση:</strong> προβολή ημερολογίου / αναφορών
          </p>
        </div>
      </Card>
    </div>
  );
}
