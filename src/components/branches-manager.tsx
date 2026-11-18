"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label } from "@/components/ui";

type Branch = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  aadeBranchCode: number;
  active: boolean;
  _count?: { vehicles: number };
};

export function BranchesManager({
  initialBranches,
}: {
  initialBranches: Branch[];
}) {
  const router = useRouter();
  const [branches, setBranches] = useState(initialBranches);
  const [form, setForm] = useState({
    name: "",
    code: "",
    address: "",
    city: "",
    phone: "",
    aadeBranchCode: "0",
  });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    const res = await fetch("/api/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        aadeBranchCode: Number(form.aadeBranchCode) || 0,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      setMsg("Αποτυχία");
      return;
    }
    setForm({
      name: "",
      code: "",
      address: "",
      city: "",
      phone: "",
      aadeBranchCode: "0",
    });
    const list = await fetch("/api/branches").then((r) => r.json());
    setBranches(list.branches || []);
    router.refresh();
    setMsg("Κατάστημα προστέθηκε");
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-display text-lg">Νέο κατάστημα</h2>
        <form onSubmit={create} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Όνομα</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <Label>Κωδικός</Label>
            <Input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="HER"
            />
          </div>
          <div>
            <Label>Διεύθυνση</Label>
            <Input
              value={form.address}
              onChange={(e) =>
                setForm((f) => ({ ...f, address: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>Πόλη</Label>
            <Input
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
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
            <Label>ΑΑΔΕ κωδ. εγκατάστασης</Label>
            <Input
              type="number"
              min={0}
              value={form.aadeBranchCode}
              onChange={(e) =>
                setForm((f) => ({ ...f, aadeBranchCode: e.target.value }))
              }
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={loading}>
              Προσθήκη
            </Button>
          </div>
        </form>
        {msg ? <p className="mt-2 text-sm text-muted">{msg}</p> : null}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((b) => (
          <Card key={b.id}>
            <h2 className="font-display text-lg">{b.name}</h2>
            <p className="mt-1 text-sm text-muted">
              {[b.address, b.city].filter(Boolean).join(", ") ||
                "Χωρίς διεύθυνση"}
            </p>
            <p className="mt-3 text-xs text-muted">
              ΑΑΔΕ branch: {b.aadeBranchCode}
              {b._count ? ` · Οχήματα: ${b._count.vehicles}` : ""}
              {b.code ? ` · ${b.code}` : ""}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
