import Stripe from "stripe";
import { openSecret } from "@/lib/secret-box";

const clientCache = new Map<string, Stripe>();

export function isStripeSecretKey(key: string | null | undefined): boolean {
  const k = (key || "").trim();
  return k.startsWith("sk_") || k.startsWith("rk_");
}

export function isStripeTestSecretKey(key: string | null | undefined): boolean {
  const k = (key || "").trim();
  return k.startsWith("sk_test_") || k.startsWith("rk_test_");
}

export function getOrgStripe(secretKeySealed: string | null | undefined) {
  const key = openSecret(secretKeySealed);
  if (!isStripeSecretKey(key)) {
    throw new Error("Λείπει έγκυρο Stripe Secret Key του οργανισμού");
  }
  let client = clientCache.get(key!);
  if (!client) {
    client = new Stripe(key!);
    clientCache.set(key!, client);
  }
  return client;
}

export function orgCanAcceptPayments(org: {
  stripeSecretKey?: string | null;
  stripeChargesEnabled?: boolean;
}) {
  const key = openSecret(org.stripeSecretKey);
  return Boolean(isStripeSecretKey(key) && org.stripeChargesEnabled);
}

export function appOrigin(req?: Request) {
  if (req) {
    const host =
      req.headers.get("x-forwarded-host") || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || "https";
    if (host) return `${proto}://${host}`;
  }
  return (
    process.env.AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}
