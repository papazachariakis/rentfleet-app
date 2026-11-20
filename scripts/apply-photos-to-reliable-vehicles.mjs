/**
 * Apply synced website fleet photos to REAL Reliable vehicles (by make/model),
 * not only to WEB-* placeholders / named categories.
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rfRoot = join(__dirname, "..");
const webRoot = join(rfRoot, "..", "RELIABLE RENT A CAR", "auto-reliable-web");
const photosPath = join(webRoot, "src", "lib", "fleet-photos.json");
const fleetPath = join(webRoot, "scripts", "scraped-fleet", "fleet.json");

function loadEnvFile(p) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const v = m[2].replace(/^"|"$/g, "");
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnvFile(join(rfRoot, ".env"));

const TOKEN = "74965e12e3bc";
const photos = JSON.parse(readFileSync(photosPath, "utf8"));
const fleet = existsSync(fleetPath)
  ? JSON.parse(readFileSync(fleetPath, "utf8"))
  : [];
const prisma = new PrismaClient();

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/i-10/g, "i10")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Explicit overrides for desk naming quirks */
const ALIASES = [
  { test: /hyundai.*i\s*10|i-?10/i, slug: "hyundai-i10" },
  { test: /fiat.*panda/i, slug: "fiat-panda" },
  { test: /fiat.*500/i, slug: "fiat-500" },
  { test: /citroen.*c3|citroën.*c3/i, slug: "citroen-c3" },
  { test: /opel.*corsa/i, slug: "opel-corsa" },
  { test: /peugeot.*208/i, slug: "peugeot-208" },
  { test: /peugeot.*traveller|peugeot.*bus/i, slug: "peugeot-traveller" },
  { test: /suzuki.*ignis/i, slug: "suzuki-ignis" },
  { test: /suzuki.*swift/i, slug: "suzuki-swift" },
  { test: /suzuki.*celerio/i, slug: "suzuki-celerio" },
  { test: /toyota.*corolla/i, slug: "toyota-corolla" },
  { test: /toyota.*aygo/i, slug: "toyota-aygo" },
  { test: /toyota.*auris/i, slug: "toyota-auris" },
  { test: /toyota.*yaris/i, slug: "toyota-yaris-hybrid-automatic" },
  { test: /nissan.*micra.*auto/i, slug: "nissan-micra-automatic" },
  { test: /nissan.*micra/i, slug: "nissan-micra" },
  { test: /nissan.*note/i, slug: "nissan-note" },
  { test: /kia.*picanto/i, slug: "kia-picanto" },
  { test: /kia.*rio/i, slug: "kia-rio" },
  { test: /dacia.*lodgy|dacia.*stepway/i, slug: "dacia-lodgy" },
  { test: /volkswagen.*caddy|vw.*caddy/i, slug: "volkswagen-caddy" },
  { test: /volkswagen.*passat|vw.*passat/i, slug: "volkswagen-passat" },
  // Closest stand-ins when website had no exact model photo
  { test: /ford.*fiesta/i, slug: "opel-corsa" },
  { test: /mitsubishi.*space/i, slug: "nissan-micra" },
];

function photoForVehicle(make, model) {
  const label = `${make} ${model}`;
  for (const a of ALIASES) {
    if (a.test.test(label)) {
      const hit = photos.find((p) => p.slug === a.slug);
      if (hit) return hit.url;
    }
  }

  const blob = norm(label);
  const ranked = photos
    .map((p) => {
      const slug = norm(p.slug.replace(/-/g, " "));
      const tokens = slug.split(/\s+/).filter((t) => t.length > 1);
      const hits = tokens.filter((t) => blob.includes(t)).length;
      return { p, hits, tokens: tokens.length };
    })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.tokens - b.tokens);

  if (ranked[0] && ranked[0].hits >= Math.min(2, ranked[0].tokens)) {
    return ranked[0].p.url;
  }
  if (ranked[0]) return ranked[0].p.url;
  return null;
}

function categoryPhoto(name) {
  const n = norm(name);
  const hit = photos.find((p) => {
    const slug = norm(p.slug.replace(/-/g, " "));
    return n.includes(slug) || slug.includes(n.replace(/ or similar.*/, ""));
  });
  return hit?.url || null;
}

async function main() {
  const org = await prisma.organization.findUnique({
    where: { publicToken: TOKEN },
  });
  if (!org) throw new Error("org not found");

  const vehicles = await prisma.vehicle.findMany({
    where: { organizationId: org.id, active: true },
    include: { category: true },
    orderBy: { plateNumber: "asc" },
  });

  console.log("vehicles", vehicles.length);
  let updated = 0;
  for (const v of vehicles) {
    // Skip pure web placeholders only if we also update real plates — still update them
    const url = photoForVehicle(v.make, v.model);
    if (!url) {
      console.log("NO MATCH", v.plateNumber, v.make, v.model);
      continue;
    }
    const same = v.photos?.[0] === url && v.photos.length === 1;
    if (same) {
      console.log("ok", v.plateNumber, v.make, v.model);
      continue;
    }
    await prisma.vehicle.update({
      where: { id: v.id },
      data: { photos: [url] },
    });
    updated++;
    console.log("SET", v.plateNumber, `${v.make} ${v.model}`, "→", url.split("/").pop());
  }

  // Refresh category cover from first matching vehicle photo (incl. inactive CAT.*)
  const cats = await prisma.vehicleCategory.findMany({
    where: { organizationId: org.id },
  });
  for (const c of cats) {
    const inCat = vehicles.filter((v) => v.categoryId === c.id);
    let url = null;
    for (const v of inCat) {
      url = photoForVehicle(v.make, v.model);
      if (url) break;
    }
    if (!url && !c.name.startsWith("CAT.")) url = categoryPhoto(c.name);
    if (url && c.imageUrl !== url) {
      await prisma.vehicleCategory.update({
        where: { id: c.id },
        data: { imageUrl: url },
      });
      console.log("cover", c.name, "→", url.split("/").pop());
    }
  }

  console.log("updated vehicles:", updated);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
