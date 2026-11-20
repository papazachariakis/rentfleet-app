import type { PublicDeal } from "@/lib/deals";

export function PublicDealBanner({
  deals,
  primary,
}: {
  deals: PublicDeal[];
  primary?: string;
}) {
  if (!deals.length) return null;
  const accent = primary || "#1b6ca8";

  return (
    <div
      className="mb-6 overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm"
      role="region"
      aria-label="Προσφορές"
    >
      <div
        className="px-4 py-2 text-[11px] font-semibold tracking-wide text-white uppercase"
        style={{ background: accent }}
      >
        Ενεργές προσφορές
      </div>
      <ul className="divide-y divide-border/60">
        {deals.map((d) => (
          <li
            key={d.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-white"
                  style={{ background: accent }}
                >
                  {d.badge}
                </span>
                <p className="font-medium text-ink">{d.title}</p>
              </div>
              {d.body ? (
                <p className="mt-1 text-sm text-muted">{d.body}</p>
              ) : null}
              {d.minDays ? (
                <p className="mt-1 text-xs text-muted">
                  Ισχύει από {d.minDays} ημέρες ενοικίασης
                </p>
              ) : null}
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-lg text-ink">{d.priceLabel}</p>
              <a
                href="#book-form"
                className="mt-1 inline-block text-xs font-semibold underline-offset-2 hover:underline"
                style={{ color: accent }}
              >
                {d.cta}
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
