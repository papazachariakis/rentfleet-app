import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { PublicBookForm } from "@/components/public-book-form";
import { orgCanAcceptPayments } from "@/lib/stripe";
import { brandingCssVars } from "@/lib/branding";
import {
  partnerKindLabel,
  sortByCategoryName,
} from "@/lib/utils";
import { resolvePartnerRates } from "@/lib/pricing";
import { loadPartnerByPublicToken } from "@/lib/partners";
import { Card } from "@/components/ui";

export default async function PartnerBookPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const partner = await loadPartnerByPublicToken(token);
  if (!partner?.organization?.publicToken) notFound();

  const org = await prisma.organization.findUnique({
    where: { id: partner.organizationId },
    include: {
      categories: { where: { active: true } },
      branches: { where: { active: true } },
      extras: { where: { active: true }, orderBy: { name: "asc" } },
    },
  });
  if (!org?.publicToken) notFound();

  const categories = sortByCategoryName(org.categories).map((c) => {
    const rates = resolvePartnerRates(
      {
        categoryId: c.id,
        category: {
          id: c.id,
          baseDailyRate: c.baseDailyRate,
          depositAmount: c.depositAmount,
        },
      },
      partner
    );
    return {
      ...c,
      baseDailyRate: rates.dailyRate,
      depositAmount: rates.depositAmount,
    };
  });

  const paymentsEnabled = orgCanAcceptPayments(org);
  const primary = org.brandPrimary || "#1b6ca8";
  const vars = brandingCssVars(org);
  const kind = partnerKindLabel(partner.kind);

  return (
    <div
      className="min-h-screen"
      style={{
        ...vars,
        background: `linear-gradient(165deg, ${primary}14 0%, #f7f9fc 42%, #eef3f8 100%)`,
      }}
    >
      <header className="border-b border-border/50 bg-white/75 backdrop-blur-md">
        <div className="page-shell flex max-w-3xl items-center justify-between py-4">
          <div className="flex items-center gap-3">
            {org.brandLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={org.brandLogoUrl}
                alt={org.name}
                className="h-10 w-auto max-w-[140px] object-contain"
              />
            ) : null}
            <div>
              <p className="font-display text-xl text-accent">{org.name}</p>
              <p className="text-xs text-muted">
                Κράτηση μέσω {kind}: {partner.name}
              </p>
            </div>
          </div>
          {!org.hidePoweredBy ? (
            <Link href="/" className="text-xs text-muted hover:text-foreground">
              Powered by RentFleet
            </Link>
          ) : (
            <span />
          )}
        </div>
      </header>

      <main className="page-shell max-w-3xl py-10">
        <h1 className="font-display text-3xl tracking-tight text-ink">
          Ιδιωτική κράτηση
        </h1>
        <p className="mt-2 text-muted">
          Τιμές σύμφωνα με τη συμφωνία «{partner.name}»
          {partner.discountPercent != null && partner.discountPercent > 0
            ? ` · έκπτωση ${partner.discountPercent}% όπου δεν υπάρχει ειδική τιμή`
            : ""}
          {paymentsEnabled ? " · ασφαλής πληρωμή με Stripe" : ""}.
        </p>

        {categories.length === 0 ? (
          <Card elevated className="mt-8">
            <p className="text-sm text-muted">
              Δεν υπάρχουν διαθέσιμες κατηγορίες ακόμα.
            </p>
          </Card>
        ) : (
          <Card elevated className="mt-8" padding="md">
            <Suspense fallback={<p className="text-sm text-muted">Φόρτωση…</p>}>
              <PublicBookForm
                token={org.publicToken}
                orgName={org.name}
                categories={categories}
                branches={org.branches}
                extras={org.extras}
                paymentsEnabled={paymentsEnabled}
                brandPrimary={primary}
                partnerToken={partner.publicToken}
                partnerName={partner.name}
              />
            </Suspense>
          </Card>
        )}
      </main>
    </div>
  );
}
