import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { PublicBookForm } from "@/components/public-book-form";
import { PublicDealBanner } from "@/components/public-deal-banner";
import { orgCanAcceptPayments } from "@/lib/stripe";
import { brandingCssVars } from "@/lib/branding";
import { toPublicDeals } from "@/lib/deals";
import { sortByCategoryName } from "@/lib/utils";
import { Card } from "@/components/ui";

export default async function PublicBookPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const org = await prisma.organization.findUnique({
    where: { publicToken: token },
    include: {
      categories: { where: { active: true } },
      branches: { where: { active: true } },
      extras: { where: { active: true }, orderBy: { name: "asc" } },
      deals: {
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      },
    },
  });

  if (!org) notFound();
  const categories = sortByCategoryName(org.categories);
  const publicDeals = toPublicDeals(org.deals, categories);

  const paymentsEnabled = orgCanAcceptPayments(org);
  const primary = org.brandPrimary || "#1b6ca8";
  const vars = brandingCssVars(org);
  const hero = org.brandHeroText || "Κλείσε όχημα";
  const tagline =
    org.brandTagline ||
    `Online κράτηση${paymentsEnabled ? " · ασφαλής πληρωμή με Stripe" : ""}`;

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
              {org.brandTagline ? (
                <p className="text-xs text-muted">{org.brandTagline}</p>
              ) : (
                <p className="text-xs text-muted">Online κράτηση</p>
              )}
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
          {hero}
        </h1>
        <p className="mt-2 text-muted">{tagline}</p>

        <div className="mt-6">
          <PublicDealBanner deals={publicDeals} primary={primary} />
        </div>

        {categories.length === 0 ? (
          <Card elevated className="mt-2">
            <p className="text-sm text-muted">
              Δεν υπάρχουν διαθέσιμες κατηγορίες ακόμα.
            </p>
          </Card>
        ) : (
          <div id="book-form" className="mt-2 scroll-mt-6">
            <Card elevated padding="md">
              <Suspense fallback={<p className="text-sm text-muted">Φόρτωση…</p>}>
                <PublicBookForm
                  token={token}
                  orgName={org.name}
                  categories={categories}
                  branches={org.branches}
                  extras={org.extras}
                  paymentsEnabled={paymentsEnabled}
                  brandPrimary={primary}
                />
              </Suspense>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
