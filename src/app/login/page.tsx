"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Input, Label } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@rentfleet.gr");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Αποτυχία σύνδεσης");
      return;
    }
    router.push(data.redirectTo || "/dashboard");
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
          className="pointer-events-none absolute -right-20 top-24 h-72 w-72 rounded-full opacity-30"
          style={{
            background:
              "radial-gradient(circle, rgba(227,240,249,0.35) 0%, transparent 70%)",
          }}
        />
        <div className="relative z-10">
          <Link href="/" className="font-display text-3xl tracking-tight">
            RentFleet
          </Link>
          <p className="mt-3 max-w-sm text-sm text-white/70">
            Desk ops, online κρατήσεις και ΑΑΔΕ — σε ένα premium SaaS για
            ελληνικά rent-a-car.
          </p>
        </div>
        <p className="relative z-10 text-xs text-white/45">
          Ψηφιακό Πελατολόγιο · myDATA · Stripe
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
            <h1 className="font-display text-3xl text-ink">Καλώς ήρθες</h1>
            <p className="mt-2 text-sm text-muted">
              Demo: demo@rentfleet.gr / demo1234
            </p>
            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Κωδικός</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Σύνδεση…" : "Είσοδος"}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted">
              Δεν έχεις λογαριασμό;{" "}
              <Link href="/register" className="font-medium text-accent">
                Εγγραφή
              </Link>
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
