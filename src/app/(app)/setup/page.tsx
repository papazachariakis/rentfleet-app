import Link from "next/link";
import { getSession } from "@/lib/session";
import { Badge, Card, PageHeader } from "@/components/ui";
import { getSetupChecklist } from "@/lib/setup-checklist";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";

export default async function SetupPage() {
  const session = await getSession();
  if (!session) return null;

  const checklist = await getSetupChecklist(session.organizationId);
  const { steps, progress, publicBookUrl, org } = checklist;
  const pct = Math.round(
    (progress.requiredDone / Math.max(1, progress.requiredTotal)) * 100
  );

  return (
    <div>
      <PageHeader
        title="Στήσιμο βήμα βήμα"
        description={`${org?.name || "Η εταιρεία σου"} · ολοκλήρωση υποχρεωτικών ${progress.requiredDone}/${progress.requiredTotal}`}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase text-muted">Πρόοδος</p>
          <p className="mt-2 text-3xl font-semibold">{pct}%</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-muted">Desk ops</p>
          <p className="mt-2">
            <Badge tone={progress.readyForDesk ? "success" : "warning"}>
              {progress.readyForDesk ? "Έτοιμο" : "Λείπουν βήματα"}
            </Badge>
          </p>
          <p className="mt-2 text-sm text-muted">
            Κρατήσεις στο γκισέ, σύμβαση + GDPR, ΑΑΔΕ offline
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-muted">Online + Stripe</p>
          <p className="mt-2">
            <Badge tone={progress.readyForOnline ? "success" : "neutral"}>
              {progress.readyForOnline ? "Έτοιμο" : "Προαιρετικό"}
            </Badge>
          </p>
          <p className="mt-2 text-sm text-muted">
            Δημόσιο `/book/…` με πληρωμή
          </p>
        </Card>
      </div>

      <Card className="mb-6">
        <h2 className="font-display text-lg">Checklist</h2>
        <ol className="mt-4 divide-y divide-border">
          {steps.map((step, idx) => (
            <li
              key={step.id}
              className="flex flex-wrap items-start justify-between gap-3 py-4"
            >
              <div className="flex gap-3">
                {step.done ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
                )}
                <div>
                  <p className="font-medium">
                    {idx + 1}. {step.title}{" "}
                    {step.required ? (
                      <span className="text-xs text-danger">υποχρεωτικό</span>
                    ) : (
                      <span className="text-xs text-muted">προαιρετικό</span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-muted">{step.description}</p>
                </div>
              </div>
              <Link
                href={step.href}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                {step.done ? "Άνοιγμα" : "Ολοκλήρωση"}
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg">Δημόσιο booking</h2>
          {publicBookUrl ? (
            <>
              <p className="mt-2 break-all text-sm text-accent">
                <Link href={publicBookUrl} className="hover:underline">
                  {publicBookUrl}
                </Link>
              </p>
              <p className="mt-2 text-sm text-muted">
                Στείλε το σε πελάτες ή βάλε το στο site σου.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">Θα εμφανιστεί μετά την εγγραφή.</p>
          )}
        </Card>
        <Card>
          <h2 className="font-display text-lg">Αναλυτικός οδηγός</h2>
          <p className="mt-2 text-sm text-muted">
            Πλήρης περιγραφή: στόλος, πάροχος ΑΑΔΕ, σύμβαση + GDPR για
            υπογραφή, Stripe, OCR άδειας, καθημερινή λειτουργία.
          </p>
          <Link
            href="/guide"
            className="mt-4 inline-flex rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-dark"
          >
            Άνοιγμα οδηγού βήμα βήμα
          </Link>
          <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>Εγγραφή → ΑΦΜ + πάροχος στο /tax (offline)</li>
            <li>Κατηγορίες (επεξεργάσιμες) + οχήματα στο /fleet</li>
            <li>
              Desk κράτηση → Εκτύπωση για υπογραφή (σύμβαση + GDPR) →
              check-out/in
            </li>
            <li>Stripe keys + webhook στο /payments</li>
            <li>Μοίρασε το /book link</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}
