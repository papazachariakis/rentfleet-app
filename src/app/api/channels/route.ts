import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canManageSettings, canWriteOps } from "@/lib/permissions";
import { sealSecret } from "@/lib/secret-box";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const channels = await prisma.channelConnection.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    channels: channels.map((c) => ({
      ...c,
      credentials: undefined,
      hasCredentials: Boolean(c.credentials),
    })),
  });
}

const schema = z.object({
  provider: z.enum(["BOOKING", "AIRBNB", "EXPEDIA", "ICAL", "CUSTOM"]),
  name: z.string().min(2).max(80),
  externalId: z.string().max(120).optional().nullable(),
  icalUrl: z.string().url().optional().nullable().or(z.literal("")),
  credentials: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  status: z.enum(["ACTIVE", "PAUSED"]).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageSettings(session) && !canWriteOps(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageSettings(session)) {
    return NextResponse.json({ error: "Μόνο διαχειριστής" }, { status: 403 });
  }

  try {
    const body = schema.parse(await req.json());
    const channel = await prisma.channelConnection.create({
      data: {
        organizationId: session.organizationId,
        provider: body.provider,
        name: body.name.trim(),
        externalId: body.externalId || null,
        icalUrl: body.icalUrl || null,
        credentials: body.credentials?.trim()
          ? sealSecret(body.credentials.trim())
          : null,
        notes: body.notes || null,
        status: body.status || "ACTIVE",
      },
    });
    return NextResponse.json({ ok: true, channel: { ...channel, credentials: undefined } });
  } catch {
    return NextResponse.json({ error: "Αποτυχία" }, { status: 400 });
  }
}
