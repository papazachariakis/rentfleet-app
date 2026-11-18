export type OrgBranding = {
  name: string;
  brandPrimary?: string | null;
  brandAccent?: string | null;
  brandLogoUrl?: string | null;
  brandTagline?: string | null;
  brandHeroText?: string | null;
  hidePoweredBy?: boolean | null;
};

export function brandingCssVars(b: OrgBranding) {
  const primary = b.brandPrimary || "#1b6ca8";
  const accent = b.brandAccent || primary;
  return {
    ["--rf-primary" as string]: primary,
    ["--rf-accent" as string]: accent,
    ["--rf-accent-soft" as string]: `${primary}22`,
    // Wire into shared Button/Input/Badge tokens on public pages
    ["--accent" as string]: primary,
    ["--accent-dark" as string]: accent,
    ["--accent-soft" as string]: `${primary}22`,
  } as React.CSSProperties;
}

export function isValidHexColor(v?: string | null) {
  if (!v) return true;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim());
}
