/**
 * Remove Imagin Studio fill photos that don't match real fleet year/look.
 * Keep only photos from auto-reliable.com legacy set.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TOKEN = "74965e12e3bc";

const KEEP = new Set([
  "citroen-c3",
  "dacia-stepway-7seats",
  "hyundai-i10",
  "kia-picanto",
  "opel-corsa",
  "peugeot-traveller",
  "suzuki-celerio",
  "toyota-aygo",
  "toyota-corolla",
]);

function isKeep(url: string) {
  return [...KEEP].some((k) => url.includes(`/reliable/fleet/${k}.`));
}

async function main() {
  const org = await prisma.organization.findUnique({
    where: { publicToken: TOKEN },
  });
  if (!org) throw new Error("org missing");

  const vehicles = await prisma.vehicle.findMany({
    where: { organizationId: org.id },
    select: { id: true, make: true, model: true, plateNumber: true, photos: true },
  });

  let cleared = 0;
  let kept = 0;
  for (const v of vehicles) {
    const good = (v.photos || []).filter(isKeep);
    if ((v.photos || []).length && good.length === (v.photos || []).length) {
      kept++;
      continue;
    }
    if ((v.photos || []).length === 0) continue;
    await prisma.vehicle.update({
      where: { id: v.id },
      data: { photos: good },
    });
    cleared++;
    console.log(
      `CLEARED ${v.make} ${v.model} (${v.plateNumber}) → keep ${good.length}`
    );
  }
  console.log(`Cleared ${cleared}, untouched good ${kept}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
