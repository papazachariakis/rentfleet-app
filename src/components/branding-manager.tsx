"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input, Label } from "@/components/ui";

export function BrandingManager() {
  const [form, setForm] = useState({
    brandPrimary: "#1b6ca8",
    brandAccent: "#0f1c2e",
    brandLogoUrl: "",
    brandTagline: "",
    brandHeroText: "",
    hidePoweredBy: false,
    publicToken: "",
  });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/branding")
      .then((r) => r.json())
      .then((d) => {
        const b = d.branding || {};
        setForm({
          brandPrimary: b.brandPrimary || "#1b6ca8",
          brandAccent: b.brandAccent || "#0f1c2e",
          brandLogoUrl: b.brandLogoUrl || "",
          brandTagline: b.brandTagline || "",
          brandHeroText: b.brandHeroText || "",
          hidePoweredBy: Boolean(b.hidePoweredBy),
          publicToken: b.publicToken || "",
        });
      });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    const res = await fetch("/api/branding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    setMsg(res.ok ? "Αποθηκεύτηκε" : "Σφάλμα");
  }

  return (
    <Card>
      <h2 className="font-display text-lg">White-label θέμα</h2>
      <p className="mt-1 text-sm text-muted">
        Εμφανίζεται στο δημόσιο{" "}
        {form.publicToken ? (
          <a
            href={`/book/${form.publicToken}`}
            className="text-accent hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            /book/{form.publicToken}
          </a>
        ) : (
          "/book/…"
        )}
      </p>
      <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Primary χρώμα</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              className="h-11 w-14 p-1"
              value={form.brandPrimary}
              onChange={(e) =>
                setForm((f) => ({ ...f, brandPrimary: e.target.value }))
              }
            />
            <Input
              value={form.brandPrimary}
              onChange={(e) =>
                setForm((f) => ({ ...f, brandPrimary: e.target.value }))
              }
            />
          </div>
        </div>
        <div>
          <Label>Accent χρώμα</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              className="h-11 w-14 p-1"
              value={form.brandAccent}
              onChange={(e) =>
                setForm((f) => ({ ...f, brandAccent: e.target.value }))
              }
            />
            <Input
              value={form.brandAccent}
              onChange={(e) =>
                setForm((f) => ({ ...f, brandAccent: e.target.value }))
              }
            />
          </div>
        </div>
        <div className="sm:col-span-2">
          <Label>Logo URL</Label>
          <Input
            value={form.brandLogoUrl}
            onChange={(e) =>
              setForm((f) => ({ ...f, brandLogoUrl: e.target.value }))
            }
            placeholder="https://…"
          />
        </div>
        <div>
          <Label>Tagline</Label>
          <Input
            value={form.brandTagline}
            onChange={(e) =>
              setForm((f) => ({ ...f, brandTagline: e.target.value }))
            }
            placeholder="Rent a car in Crete"
          />
        </div>
        <div>
          <Label>Hero κείμενο</Label>
          <Input
            value={form.brandHeroText}
            onChange={(e) =>
              setForm((f) => ({ ...f, brandHeroText: e.target.value }))
            }
            placeholder="Κλείσε όχημα online"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted sm:col-span-2">
          <input
            type="checkbox"
            checked={form.hidePoweredBy}
            onChange={(e) =>
              setForm((f) => ({ ...f, hidePoweredBy: e.target.checked }))
            }
          />
          Απόκρυψη «Powered by RentFleet»
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={loading}>
            Αποθήκευση θέματος
          </Button>
          {msg ? <span className="ml-3 text-sm text-muted">{msg}</span> : null}
        </div>
      </form>
    </Card>
  );
}
