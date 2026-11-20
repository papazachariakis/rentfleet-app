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
const stmts = [
  `ALTER TABLE "VehicleCategory" ADD COLUMN IF NOT EXISTS "bags" INTEGER`,
  `ALTER TABLE "VehicleCategory" ADD COLUMN IF NOT EXISTS "doors" INTEGER`,
  `ALTER TABLE "VehicleCategory" ADD COLUMN IF NOT EXISTS "airConditioning" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "VehicleCategory" ADD COLUMN IF NOT EXISTS "hasGps" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "seats" INTEGER`,
  `ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "bags" INTEGER`,
  `ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "doors" INTEGER`,
  `ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "transmission" TEXT`,
  `ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "airConditioning" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "hasGps" BOOLEAN NOT NULL DEFAULT false`,
];

for (const sql of stmts) {
  await prisma.$executeRawUnsafe(sql);
  console.log("ok", sql.slice(0, 60));
}
await prisma.$disconnect();
console.log("done");
