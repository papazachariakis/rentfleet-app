import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function loadEnv(p) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}
loadEnv(join(root, ".env"));

const prisma = new PrismaClient();
const org = await prisma.organization.findUnique({
  where: { publicToken: "74965e12e3bc" },
});
const vs = await prisma.vehicle.findMany({
  where: { organizationId: org.id },
});
let n = 0;
for (const v of vs) {
  const raw = (v.fuelType || "").toUpperCase();
  let fuel = v.fuelType;
  if (/ΠΕΤΡΕΛ|DIESEL|DIECEL/.test(raw)) fuel = "Diesel";
  else if (/HYBRID/.test(raw)) fuel = "Hybrid";
  else if (/ΒΕΝΖ|PETROL|BENZ/.test(raw)) fuel = "Petrol";
  else if (/ELECTRIC|ΗΛΕΚΤΡ/.test(raw)) fuel = "Electric";
  if (fuel && fuel !== v.fuelType) {
    await prisma.vehicle.update({
      where: { id: v.id },
      data: { fuelType: fuel },
    });
    n++;
    console.log(v.plateNumber, v.fuelType, "->", fuel);
  }
}
console.log("normalized", n);
await prisma.$disconnect();
