/**
 * Match R2 fleet photos from auto-reliable.com to RELIABLE vehicles by make/model,
 * then set each category.imageUrl from its best vehicle photo.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TOKEN = "74965e12e3bc";
const R2 = "https://pub-a1e4897bb4484652a75702564867931e.r2.dev/reliable/fleet";

const PHOTOS = {
  citroenC3: `${R2}/citroen-c3.jpg`,
  daciaStepway: `${R2}/dacia-stepway-7seats.png`,
  hyundaiI10: `${R2}/hyundai-i10.jpg`,
  kiaPicanto: `${R2}/kia-picanto.jpg`,
  opelCorsa: `${R2}/opel-corsa.jpg`,
  peugeotTraveller: `${R2}/peugeot-traveller.jpg`,
  suzukiCelerio: `${R2}/suzuki-celerio.jpg`,
  toyotaAygo: `${R2}/toyota-aygo.jpg`,
  toyotaCorolla: `${R2}/toyota-corolla.png`,
} as const;

function matchPhoto(make: string, model: string): string | null {
  const m = make.toUpperCase().replace(/\./g, "").trim();
  const mo = model.toUpperCase().replace(/\s+/g, " ").trim();

  if (m.includes("CITROEN") && mo.includes("C3")) return PHOTOS.citroenC3;
  if (m.includes("DACIA") && (mo.includes("LODGY") || mo.includes("STEPWAY")))
    return PHOTOS.daciaStepway;
  if (m.includes("HYUNDAI") && (mo.includes("I-10") || mo.includes("I10") || mo.includes("I 10")))
    return PHOTOS.hyundaiI10;
  if (m.includes("KIA")) return PHOTOS.kiaPicanto;
  if (m.includes("OPEL") && mo.includes("CORSA")) return PHOTOS.opelCorsa;
  if (m.includes("TOYOTA") && mo.includes("AYGO")) return PHOTOS.toyotaAygo;
  if (m.includes("TOYOTA") && (mo.includes("COROLLA") || mo.includes("AURIS")))
    return PHOTOS.toyotaCorolla;
  if (m.includes("SUZUKI") && mo.includes("IGNIS")) return PHOTOS.suzukiCelerio;
  if (
    m.includes("PEUGEOT") &&
    (mo.includes("TRAVELLER") || mo.includes("BUS") || mo.includes("EXPERT"))
  )
    return PHOTOS.peugeotTraveller;

  return null;
}

/** Fallback cover per category when no vehicle matched a photo */
const CATEGORY_FALLBACK: Record<string, string> = {
  "CAT. A": PHOTOS.hyundaiI10,
  "CAT. B": PHOTOS.citroenC3,
  "CAT. C": PHOTOS.opelCorsa,
  "CAT. D": PHOTOS.toyotaCorolla,
  "CAT. D Economy": PHOTOS.toyotaCorolla,
  "CAT. D+": PHOTOS.toyotaCorolla,
  "CAT. D1 AUTOMATIC": PHOTOS.toyotaAygo,
  "CAT. D2": PHOTOS.opelCorsa,
  "CAT. D2 AUTOMATIC": PHOTOS.toyotaCorolla,
  "CAT. E": PHOTOS.daciaStepway,
  "CAT. F/ M.BUSS": PHOTOS.peugeotTraveller,
};

async function main() {
  const org = await prisma.organization.findUnique({
    where: { publicToken: TOKEN },
  });
  if (!org) throw new Error("Org not found");

  const vehicles = await prisma.vehicle.findMany({
    where: { organizationId: org.id, active: true },
    select: { id: true, make: true, model: true, plateNumber: true, categoryId: true },
  });

  let matched = 0;
  const byCategory = new Map<string, string[]>();

  for (const v of vehicles) {
    const url = matchPhoto(v.make, v.model);
    if (!url) {
      console.log(`SKIP ${v.make} ${v.model} (${v.plateNumber})`);
      continue;
    }
    await prisma.vehicle.update({
      where: { id: v.id },
      data: { photos: [url] },
    });
    matched++;
    console.log(`OK   ${v.make} ${v.model} (${v.plateNumber}) → ${url.split("/").pop()}`);
    if (v.categoryId) {
      const list = byCategory.get(v.categoryId) || [];
      list.push(url);
      byCategory.set(v.categoryId, list);
    }
  }

  const categories = await prisma.vehicleCategory.findMany({
    where: { organizationId: org.id, active: true },
  });

  for (const c of categories) {
    const fromVehicles = byCategory.get(c.id)?.[0];
    const imageUrl =
      fromVehicles || CATEGORY_FALLBACK[c.name] || PHOTOS.toyotaAygo;
    await prisma.vehicleCategory.update({
      where: { id: c.id },
      data: { imageUrl },
    });
    console.log(`CAT  ${c.name} → ${imageUrl.split("/").pop()}`);
  }

  console.log(`\nMatched vehicles: ${matched}/${vehicles.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
