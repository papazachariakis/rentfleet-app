import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { canManageSettings } from "@/lib/permissions";
import { syncIcalChannel } from "@/lib/channels";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageSettings(session)) {
    return NextResponse.json({ error: "Μόνο διαχειριστής" }, { status: 403 });
  }

  try {
    const { id } = await ctx.params;
    const channel = await prisma.channelConnection.findFirst({
      where: { id, organizationId: session.organizationId },
    });
    if (!channel) {
      return NextResponse.json({ error: "Δεν βρέθηκε" }, { status: 404 });
    }
    if (channel.provider !== "ICAL" && !channel.icalUrl) {
      return NextResponse.json(
        {
          error:
            "Για Booking/Airbnb/Expedia: βάλε iCal URL (calendar export) ή χρησιμοποίησε χειροκίνητο import. Native API sync έρχεται σε επόμενο sprint.",
        },
        { status: 400 }
      );
    }
    const result = await syncIcalChannel(id, session.organizationId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const code = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json(
      { error: code.startsWith("ICAL_") ? `Σφάλμα iCal: ${code}` : "Αποτυχία sync" },
      { status: 400 }
    );
  }
}
