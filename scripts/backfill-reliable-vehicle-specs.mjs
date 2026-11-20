/**
 * Backfill seats/bags/doors/transmission/AC/GPS/fuelType for Reliable vehicles
 * from scraped auto-reliable.com fleet.json (+ aliases).
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = join(root, "..", "RELIABLE RENT A CAR", "auto-reliable-web");
const fleetPath = join(webRoot, "scripts", "scraped-fleet", "fleet.json");

function loadEnv(p) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}
loadEnv(join(root, ".env"));

const fleet = JSON.parse(readFileSync(fleetPath, "utf8"));
const prisma = new PrismaClient();
const TOKEN = "74965e12e3bc";

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/i-10/g, "i10")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function transmissionOf(fuel, name) {
  const t = `${fuel || ""} ${name || ""}`.toLowerCase();
  if (t.includes("automatic") || t.includes("hybrid")) return "Automatic";
  if (t.includes("manual")) return "Manual";
  return "Manual";
}

function fuelOf(fuel, model) {
  const t = `${fuel || ""} ${model || ""}`.toLowerCase();
  if (t.includes("hybrid")) return "Hybrid";
  if (t.includes("electric")) return "Electric";
  if (t.includes("diesel") && t.includes("petrol")) return "Diesel or Petrol";
  if (t.includes("diesel")) return "Diesel";
  if (t.includes("petrol") || t.includes("cabriolet")) return "Petrol";
  return "Petrol";
}

function matchFleet(make, model) {
  const blob = norm(`${make} ${model}`);
  let best = null;
  let bestScore = 0;
  for (const c of fleet) {
    const name = norm(c.name.replace(/or similar/gi, ""));
    const tokens = name.split(/\s+/).filter((x) => x.length > 1);
    const hits = tokens.filter((t) => blob.includes(t)).length;
    if (hits > bestScore) {
      bestScore = hits;
      best = c;
    }
  }
  // aliases
  if (/ford fiesta/i.test(`${make} ${model}`)) {
    return fleet.find((c) => /corsa/i.test(c.name)) || best;
  }
  if (/mitsubishi space/i.test(`${make} ${model}`)) {
    return fleet.find((c) => /micra/i.test(c.name) && !/auto/i.test(c.name)) || best;
  }
  if (/baleno/i.test(`${make} ${model}`)) {
    return fleet.find((c) => /celerio/i.test(c.name)) || best;
  }
  if (bestScore >= 1) return best;
  return null;
}

async function main() {
  const org = await prisma.organization.findUnique({
    where: { publicToken: TOKEN },
  });
  if (!org) throw new Error("org missing");

  const vehicles = await prisma.vehicle.findMany({
    where: { organizationId: org.id, active: true },
  });

  let n = 0;
  for (const v of vehicles) {
    const hit = matchFleet(v.make, v.model);
    const seats = hit?.seats ?? v.seats ?? 5;
    const bags = hit?.bags ?? v.bags ?? 2;
    const doors = hit?.doors ?? v.doors ?? 4;
    const transmission =
      v.transmission ||
      transmissionOf(hit?.fuel, `${v.make} ${v.model}`);
    const fuelType = v.fuelType || fuelOf(hit?.fuel, `${v.make} ${v.model}`);
    const airConditioning = hit?.ac ?? v.airConditioning ?? true;
    const hasGps = true; // Reliable markets GPS on every vehicle / portable

    await prisma.vehicle.update({
      where: { id: v.id },
      data: {
        seats,
        bags,
        doors,
        transmission,
        fuelType,
        airConditioning,
        hasGps,
      },
    });
    n++;
    console.log(
      v.plateNumber,
      `${v.make} ${v.model}`,
      `→ ${seats}s ${bags}b ${doors}d ${transmission} ${fuelType}`,
    );
  }

  // named categories from website
  for (const c of fleet) {
    const cat = await prisma.vehicleCategory.findFirst({
      where: {
        organizationId: org.id,
        name: { equals: c.name, mode: "insensitive" },
      },
    });
    if (!cat) continue;
    await prisma.vehicleCategory.update({
      where: { id: cat.id },
      data: {
        seats: c.seats,
        bags: c.bags,
        doors: c.doors,
        transmission: transmissionOf(c.fuel, c.name),
        airConditioning: c.ac !== false,
        hasGps: true,
      },
    });
    console.log("cat", c.name);
  }

  console.log("vehicles updated", n);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
