import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { sealSecret, maskSecret, openSecret } from "@/lib/secret-box";
import { isStripeSecretKey } from "@/lib/stripe";
import { canManageSettings } from "@/lib/permissions";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: {
      id: true,
      publicToken: true,
      stripePublishableKey: true,
      stripeSecretKey: true,
      stripeWebhookSecret: true,
      stripeChargesEnabled: true,
    },
  });

  const origin =
    process.env.AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  return NextResponse.json({
    organizationId: org?.id,
    publicToken: org?.publicToken,
    publicBookUrl: org?.publicToken
      ? `${origin.replace(/\/$/, "")}/book/${org.publicToken}`
      : null,
    webhookUrl: org?.id
      ? `${origin.replace(/\/$/, "")}/api/stripe/webhook/${org.id}`
      : null,
    publishableKeyMasked: maskSecret(org?.stripePublishableKey),
    secretKeyMasked: maskSecret(org?.stripeSecretKey),
    hasWebhookSecret: Boolean(org?.stripeWebhookSecret),
    chargesEnabled: Boolean(org?.stripeChargesEnabled),
  });
}

const schema = z.object({
  publishableKey: z.string().optional(),
  secretKey: z.string().optional(),
  webhookSecret: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageSettings(session)) {
    return NextResponse.json({ error: "Μόνο διαχειριστής" }, { status: 403 });
  }

  try {
    const body = schema.parse(await req.json());
    const data: {
      stripePublishableKey?: string;
      stripeSecretKey?: string;
      stripeWebhookSecret?: string;
      stripeChargesEnabled?: boolean;
      stripeDetailsSubmitted?: boolean;
      stripeOnboardedAt?: Date;
    } = {};

    if (body.publishableKey?.trim()) {
      data.stripePublishableKey = sealSecret(body.publishableKey.trim());
    }
    if (body.secretKey?.trim()) {
      if (!isStripeSecretKey(body.secretKey)) {
        return NextResponse.json(
          { error: "Μη έγκυρο Stripe secret key" },
          { status: 400 }
        );
      }
      data.stripeSecretKey = sealSecret(body.secretKey.trim());
      data.stripeChargesEnabled = true;
      data.stripeDetailsSubmitted = true;
      data.stripeOnboardedAt = new Date();
    }
    if (body.webhookSecret?.trim()) {
      data.stripeWebhookSecret = sealSecret(body.webhookSecret.trim());
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Δεν δόθηκαν keys" },
        { status: 400 }
      );
    }

    await prisma.organization.update({
      where: { id: session.organizationId },
      data,
    });

    // Verify sealed secret opens
    if (data.stripeSecretKey && !openSecret(data.stripeSecretKey)) {
      return NextResponse.json(
        { error: "Σφάλμα κρυπτογράφησης key" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Μη έγκυρα δεδομένα" }, { status: 400 });
  }
}
