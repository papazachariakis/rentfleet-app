"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, Input, Label, PageHeader } from "@/components/ui";

type Settings = {
  organizationId?: string;
  publicToken?: string | null;
  publicBookUrl?: string | null;
  webhookUrl?: string | null;
  publishableKeyMasked: string | null;
  secretKeyMasked: string | null;
  chargesEnabled: boolean;
  hasWebhookSecret: boolean;
};

export default function PaymentsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [publishableKey, setPublishableKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/stripe/settings");
    if (res.ok) setSettings(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    const res = await fetch("/api/stripe/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publishableKey, secretKey, webhookSecret }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error || "Αποτυχία αποθήκευσης");
      return;
    }
    setMsg("Αποθηκεύτηκε.");
    setPublishableKey("");
    setSecretKey("");
    setWebhookSecret("");
    load();
  }

  return (
    <div>
      <PageHeader
        title="Πληρωμές Stripe"
        description="BYOK — βάζεις τα δικά σου keys (όπως στο Katalima)"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg">Κατάσταση</h2>
          <div className="mt-4 space-y-2 text-sm">
            <p>
              Secret:{" "}
              <code className="text-xs">
                {settings?.secretKeyMasked || "—"}
              </code>
            </p>
            <p>
              Publishable:{" "}
              <code className="text-xs">
                {settings?.publishableKeyMasked || "—"}
              </code>
            </p>
            <Badge tone={settings?.chargesEnabled ? "success" : "warning"}>
              {settings?.chargesEnabled
                ? "Έτοιμο για χρεώσεις"
                : "Δεν είναι ενεργό"}
            </Badge>
            {settings?.publicBookUrl ? (
              <p className="pt-2">
                Δημόσιο booking:{" "}
                <a
                  href={settings.publicBookUrl}
                  className="break-all text-accent hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {settings.publicBookUrl}
                </a>
              </p>
            ) : null}
            {settings?.webhookUrl ? (
              <div className="pt-2">
                <p className="text-muted">Stripe webhook endpoint:</p>
                <code className="mt-1 block break-all rounded bg-slate-50 p-2 text-xs">
                  {settings.webhookUrl}
                </code>
                <p className="mt-1 text-xs text-muted">
                  Events: checkout.session.completed,
                  checkout.session.expired
                </p>
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-lg">Keys</h2>
          <form onSubmit={save} className="mt-4 space-y-3">
            <div>
              <Label>Publishable key (pk_)</Label>
              <Input
                value={publishableKey}
                onChange={(e) => setPublishableKey(e.target.value)}
                placeholder="pk_test_…"
              />
            </div>
            <div>
              <Label>Secret key (sk_)</Label>
              <Input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="sk_test_…"
              />
            </div>
            <div>
              <Label>Webhook secret (whsec_)</Label>
              <Input
                type="password"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="whsec_…"
              />
            </div>
            {msg ? <p className="text-sm text-muted">{msg}</p> : null}
            <Button type="submit" disabled={loading}>
              {loading ? "Αποθήκευση…" : "Αποθήκευση"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
