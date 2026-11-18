"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Input, Label } from "@/components/ui";

type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  afm: string | null;
  licenseNumber: string | null;
  isForeign: boolean;
  blacklisted: boolean;
};

export function CustomersManager({
  initialCustomers,
}: {
  initialCustomers: Customer[];
}) {
  const router = useRouter();
  const [customers, setCustomers] = useState(initialCustomers);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    afm: "",
    licenseNumber: "",
    isForeign: false,
  });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error || "Αποτυχία");
      return;
    }
    setForm({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      afm: "",
      licenseNumber: "",
      isForeign: false,
    });
    const list = await fetch("/api/customers").then((r) => r.json());
    setCustomers(list.customers || []);
    router.refresh();
    setMsg("Πελάτης προστέθηκε");
  }

  async function toggleBlacklist(c: Customer) {
    await fetch(`/api/customers/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blacklisted: !c.blacklisted }),
    });
    const list = await fetch("/api/customers").then((r) => r.json());
    setCustomers(list.customers || []);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-display text-lg">Νέος πελάτης</h2>
        <form onSubmit={create} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Όνομα</Label>
            <Input
              required
              value={form.firstName}
              onChange={(e) =>
                setForm((f) => ({ ...f, firstName: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>Επώνυμο</Label>
            <Input
              required
              value={form.lastName}
              onChange={(e) =>
                setForm((f) => ({ ...f, lastName: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <Label>Τηλέφωνο</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div>
            <Label>ΑΦΜ</Label>
            <Input
              value={form.afm}
              onChange={(e) => setForm((f) => ({ ...f, afm: e.target.value }))}
            />
          </div>
          <div>
            <Label>Δίπλωμα</Label>
            <Input
              value={form.licenseNumber}
              onChange={(e) =>
                setForm((f) => ({ ...f, licenseNumber: e.target.value }))
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isForeign}
              onChange={(e) =>
                setForm((f) => ({ ...f, isForeign: e.target.checked }))
              }
            />
            Αλλοδαπός
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={loading}>
              Προσθήκη
            </Button>
          </div>
        </form>
        {msg ? <p className="mt-2 text-sm text-muted">{msg}</p> : null}
      </Card>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-border bg-slate-50 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Όνομα</th>
              <th className="px-4 py-3">Επικοινωνία</th>
              <th className="px-4 py-3">Δίπλωμα</th>
              <th className="px-4 py-3">ΑΦΜ</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {customers.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium">
                  {c.lastName} {c.firstName}
                </td>
                <td className="px-4 py-3 text-muted">
                  {c.email || "—"}
                  {c.phone ? ` · ${c.phone}` : ""}
                </td>
                <td className="px-4 py-3">{c.licenseNumber || "—"}</td>
                <td className="px-4 py-3">
                  {c.isForeign ? (
                    <Badge tone="neutral">Αλλοδαπός</Badge>
                  ) : (
                    c.afm || "—"
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="text-xs text-muted hover:text-danger"
                    onClick={() => toggleBlacklist(c)}
                  >
                    {c.blacklisted ? (
                      <Badge tone="danger">Blacklist</Badge>
                    ) : (
                      "Blacklist"
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
