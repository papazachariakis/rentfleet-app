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
  where: { organizationId: org.id, active: true },
  select: { plateNumber: true, make: true, model: true, photos: true },
  orderBy: { plateNumber: "asc" },
});
const uniq = new Map();
for (const v of vs) {
  const url = v.photos?.[0] || "";
  const file = url.split("/").pop() || "(none)";
  if (!uniq.has(file)) uniq.set(file, []);
  uniq.get(file).push(`${v.make} ${v.model} (${v.plateNumber})`);
}
for (const [f, cars] of [...uniq.entries()].sort()) {
  console.log(f);
  for (const c of cars) console.log("  ", c);
}
console.log("TOTAL vehicles", vs.length, "unique photos", uniq.size);
await prisma.$disconnect();
