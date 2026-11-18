import { prisma } from "@/lib/prisma";
import { makeBookingCode } from "@/lib/booking-code";
import { findVehicleConflicts, priceRental, loadOrgPriceRules } from "@/lib/bookings";

export type IcalEvent = {
  uid: string;
  summary: string;
  start: Date;
  end: Date;
};

/** Minimal VEVENT parser (DTSTART/DTEND date or datetime) */
export function parseIcalEvents(ics: string): IcalEvent[] {
  const blocks = ics.split(/BEGIN:VEVENT/i).slice(1);
  const events: IcalEvent[] = [];

  for (const block of blocks) {
    const body = block.split(/END:VEVENT/i)[0] || "";
    const get = (key: string) => {
      const re = new RegExp(`^${key}[^:]*:(.+)$`, "im");
      const m = body.match(re);
      return m?.[1]?.trim().replace(/\\n/g, " ");
    };
    const uid = get("UID") || `ical-${events.length}`;
    const summary = get("SUMMARY") || "External booking";
    const startRaw = get("DTSTART");
    const endRaw = get("DTEND") || startRaw;
    if (!startRaw || !endRaw) continue;
    const start = parseIcalDate(startRaw);
    const end = parseIcalDate(endRaw);
    if (!start || !end || end <= start) continue;
    events.push({ uid, summary, start, end });
  }
  return events;
}

function parseIcalDate(raw: string): Date | null {
  const v = raw.trim();
  // YYYYMMDD
  if (/^\d{8}$/.test(v)) {
    const y = Number(v.slice(0, 4));
    const m = Number(v.slice(4, 6)) - 1;
    const d = Number(v.slice(6, 8));
    return new Date(Date.UTC(y, m, d, 10, 0, 0));
  }
  // YYYYMMDDTHHMMSSZ
  const m = v.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/
  );
  if (m) {
    return new Date(
      Date.UTC(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3]),
        Number(m[4]),
        Number(m[5]),
        Number(m[6])
      )
    );
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function syncIcalChannel(channelId: string, organizationId: string) {
  const channel = await prisma.channelConnection.findFirst({
    where: { id: channelId, organizationId },
  });
  if (!channel) throw new Error("NOT_FOUND");
  if (!channel.icalUrl) throw new Error("NO_ICAL_URL");

  const res = await fetch(channel.icalUrl, {
    headers: { Accept: "text/calendar, text/plain, */*" },
    cache: "no-store",
  });
  if (!res.ok) {
    await prisma.channelConnection.update({
      where: { id: channel.id },
      data: {
        status: "ERROR",
        lastError: `HTTP ${res.status}`,
        lastSyncAt: new Date(),
      },
    });
    throw new Error(`ICAL_HTTP_${res.status}`);
  }

  const ics = await res.text();
  const events = parseIcalEvents(ics);

  // Δημιουργεί/ανανεώνει κρατήσεις καναλιού ως PARTNER με notes = ical uid
  let created = 0;
  let skipped = 0;

  const vehicles = await prisma.vehicle.findMany({
    where: { organizationId, active: true, status: "AVAILABLE" },
    include: { category: true },
    orderBy: { plateNumber: "asc" },
    take: 20,
  });

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });
  if (!org) throw new Error("ORG_NOT_FOUND");

  for (const ev of events) {
    const existing = await prisma.booking.findFirst({
      where: {
        organizationId,
        channel: "PARTNER",
        notes: { contains: `ical:${ev.uid}` },
      },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    // Βρες ελεύθερο όχημα
    let vehicleId: string | null = null;
    let categoryId: string | null = null;
    let dailyRate = 40;
    let deposit = 300;
    for (const v of vehicles) {
      const c = await findVehicleConflicts({
        vehicleId: v.id,
        pickupAt: ev.start,
        returnAt: ev.end,
      });
      if (!c.hasConflict) {
        vehicleId = v.id;
        categoryId = v.categoryId;
        dailyRate = v.category?.baseDailyRate ?? 40;
        deposit = v.category?.depositAmount ?? 300;
        break;
      }
    }

    const customer = await prisma.customer.create({
      data: {
        firstName: "OTA",
        lastName: channel.name.slice(0, 40),
        notes: `Imported from ${channel.provider}`,
        isForeign: true,
        organizationId,
      },
    });

    const rules = await loadOrgPriceRules(organizationId, categoryId);
    const priced = priceRental({
      dailyRate,
      pickupAt: ev.start,
      returnAt: ev.end,
      vatCategory: org.vatCategory,
      depositAmount: deposit,
      rules,
      categoryId,
    });

    await prisma.booking.create({
      data: {
        code: makeBookingCode(org.name),
        channel: "PARTNER",
        status: vehicleId ? "CONFIRMED" : "DRAFT",
        pickupAt: ev.start,
        returnAt: ev.end,
        dailyRate: priced.averageDaily || dailyRate,
        days: priced.days,
        subtotal: priced.subtotal,
        vatAmount: priced.vatAmount,
        totalAmount: priced.totalAmount,
        depositAmount: priced.depositAmount,
        paymentStatus: "PAID",
        notes: `${ev.summary}\nical:${ev.uid}\nchannel:${channel.id}`,
        customerId: customer.id,
        vehicleId,
        organizationId,
      },
    });
    created += 1;
  }

  await prisma.channelConnection.update({
    where: { id: channel.id },
    data: {
      status: "ACTIVE",
      lastSyncAt: new Date(),
      lastError: null,
    },
  });

  return { created, skipped, events: events.length };
}

/** Χειροκίνητη εισαγωγή κράτησης από OTA */
export async function importExternalBooking(input: {
  organizationId: string;
  channelId?: string;
  externalRef: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  pickupAt: Date;
  returnAt: Date;
  vehicleId?: string;
  totalAmount?: number;
  notes?: string;
}) {
  const org = await prisma.organization.findUnique({
    where: { id: input.organizationId },
  });
  if (!org) throw new Error("ORG_NOT_FOUND");

  const vehicle = input.vehicleId
    ? await prisma.vehicle.findFirst({
        where: { id: input.vehicleId, organizationId: input.organizationId },
        include: { category: true },
      })
    : null;
  if (input.vehicleId && !vehicle) throw new Error("VEHICLE_NOT_FOUND");
  if (vehicle) {
    const c = await findVehicleConflicts({
      vehicleId: vehicle.id,
      pickupAt: input.pickupAt,
      returnAt: input.returnAt,
    });
    if (c.hasConflict) throw new Error("CONFLICT");
  }

  const dailyRate = vehicle?.category?.baseDailyRate ?? 40;
  const rules = await loadOrgPriceRules(
    input.organizationId,
    vehicle?.categoryId
  );
  const priced = priceRental({
    dailyRate,
    pickupAt: input.pickupAt,
    returnAt: input.returnAt,
    vatCategory: org.vatCategory,
    depositAmount: vehicle?.category?.depositAmount ?? 300,
    rules,
    categoryId: vehicle?.categoryId,
  });

  const customer = await prisma.customer.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email || null,
      phone: input.phone || null,
      isForeign: true,
      organizationId: input.organizationId,
    },
  });

  const channelNote = input.channelId ? `channel:${input.channelId}` : "";
  return prisma.booking.create({
    data: {
      code: makeBookingCode(org.name),
      channel: "PARTNER",
      status: "CONFIRMED",
      pickupAt: input.pickupAt,
      returnAt: input.returnAt,
      dailyRate: priced.averageDaily || dailyRate,
      days: priced.days,
      subtotal: priced.subtotal,
      vatAmount: priced.vatAmount,
      totalAmount: input.totalAmount ?? priced.totalAmount,
      depositAmount: priced.depositAmount,
      paymentStatus: "PAID",
      notes: [`OTA ref: ${input.externalRef}`, input.notes, channelNote]
        .filter(Boolean)
        .join("\n"),
      customerId: customer.id,
      vehicleId: vehicle?.id,
      organizationId: input.organizationId,
    },
  });
}
