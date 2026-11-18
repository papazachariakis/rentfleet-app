"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Input, Label } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    organizationName: "",
    legalForm: "LEGAL" as "NATURAL" | "LEGAL",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Αποτυχία εγγραφής");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-ink text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(145deg, rgba(27,108,168,0.55) 0%, rgba(10,22,40,0.92) 55%, rgba(15,28,46,1) 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute -left-16 bottom-20 h-80 w-80 rounded-full opacity-25"
          style={{
            background:
              "radial-gradient(circle, rgba(227,240,249,0.4) 0%, transparent 70%)",
          }}
        />
        <div className="relative z-10">
          <Link href="/" className="font-display text-3xl tracking-tight">
            RentFleet
          </Link>
          <p className="mt-3 max-w-sm text-sm text-white/70">
            Ξεκίνα σε λίγα λεπτά — στόλος, κρατήσεις και συμμόρφωση χωρίς
            διπλοεγγραφές.
          </p>
        </div>
        <p className="relative z-10 text-xs text-white/45">
          Δωρεάν δοκιμή · χωρίς κάρτα
        </p>
      </aside>

      <div className="flex items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-md animate-fade-up">
          <Link
            href="/"
            className="font-display text-2xl text-accent lg:hidden"
          >
            RentFleet
          </Link>
          <Card elevated className="mt-6 lg:mt-0">
            <h1 className="font-display text-3xl text-ink">
              Δημιούργησε λογαριασμό
            </h1>
            <p className="mt-2 text-sm text-muted">Δωρεάν δοκιμή · χωρίς κάρτα</p>
            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <div>
                <Label>Ονοματεπώνυμο</Label>
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Επωνυμία rent-a-car</Label>
                <Input
                  value={form.organizationName}
                  onChange={(e) => set("organizationName", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Κωδικός (min 6)</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Δημιουργία…" : "Εγγραφή"}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted">
              Έχεις ήδη λογαριασμό;{" "}
              <Link href="/login" className="font-medium text-accent">
                Είσοδος
              </Link>
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
