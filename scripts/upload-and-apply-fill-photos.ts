import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const prisma = new PrismaClient();
const TOKEN = "74965e12e3bc";
const cacheDir = join(process.cwd(), ".cache-assets", "fleet-fill");

function loadEnvFile(p: string) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

loadEnvFile(join(process.cwd(), "..", "AMMOUDI", ".env.local"));
loadEnvFile(join(process.cwd(), ".env"));

const MATCHERS: { key: string; match: (make: string, model: string) => boolean }[] = [
  { key: "fiat-panda", match: (m, mo) => m.includes("FIAT") && mo.includes("PANDA") },
  { key: "fiat-500", match: (m, mo) => m.includes("FIAT") && mo.includes("500") },
  { key: "ford-fiesta", match: (m, mo) => m.includes("FORD") && mo.includes("FIESTA") },
  {
    key: "mitsubishi-space-star",
    match: (m, mo) => m.includes("MITSUBISHI") && mo.includes("SPACE"),
  },
  { key: "peugeot-208", match: (m, mo) => m.includes("PEUGEOT") && mo.includes("208") },
  { key: "suzuki-swift", match: (m, mo) => m.includes("SUZUKI") && mo.includes("SWIFT") },
  { key: "suzuki-baleno", match: (m, mo) => m.includes("SUZUKI") && mo.includes("BALENO") },
  { key: "nissan-micra", match: (m, mo) => m.includes("NISSAN") && mo.includes("MICRA") },
  { key: "nissan-note", match: (m, mo) => m.includes("NISSAN") && mo.includes("NOTE") },
  { key: "audi-q2", match: (m, mo) => m.includes("AUDI") && mo.includes("Q2") },
  { key: "toyota-yaris", match: (m, mo) => m.includes("TOYOTA") && mo.includes("YARIS") },
  {
    key: "vw-up",
    match: (m, mo) => (m.includes("VW") || m.includes("VW")) && /\bUP\b/.test(mo),
  },
  {
    key: "vw-passat",
    match: (m, mo) => (m.includes("VW") || m.includes("VW")) && mo.includes("PASSAT"),
  },
];

async function main() {
  for (const k of [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "R2_PUBLIC_BASE_URL",
  ]) {
    if (!process.env[k]) throw new Error(`Missing ${k}`);
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  const files = readdirSync(cacheDir).filter((f) => f.endsWith(".jpg"));
  const urlByKey = new Map<string, string>();

  for (const file of files) {
    const keyName = file.replace(/\.jpg$/i, "");
    const buf = readFileSync(join(cacheDir, file));
    if (buf.length < 5000) {
      console.log("skip tiny", file);
      continue;
    }
    const r2Key = `reliable/fleet/${keyName}.jpg`;
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: r2Key,
        Body: buf,
        ContentType: "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    const url = `${process.env.R2_PUBLIC_BASE_URL!.replace(/\/$/, "")}/${r2Key}`;
    urlByKey.set(keyName, url);
    console.log("uploaded", keyName, buf.length);
  }

  const org = await prisma.organization.findUnique({
    where: { publicToken: TOKEN },
  });
  if (!org) throw new Error("org missing");

  const vehicles = await prisma.vehicle.findMany({
    where: { organizationId: org.id, active: true },
    select: { id: true, make: true, model: true, plateNumber: true, photos: true },
  });

  let updated = 0;
  for (const v of vehicles) {
    if (v.photos?.length) continue;
    const make = v.make.toUpperCase().replace(/\./g, "");
    const model = v.model.toUpperCase();
    const src = MATCHERS.find((s) => s.match(make, model));
    if (!src) {
      console.log("NO MATCH", v.make, v.model);
      continue;
    }
    const url = urlByKey.get(src.key);
    if (!url) {
      console.log("NO FILE", src.key, v.make, v.model);
      continue;
    }
    await prisma.vehicle.update({
      where: { id: v.id },
      data: { photos: [url] },
    });
    updated++;
    console.log("OK", v.make, v.model, v.plateNumber, "→", src.key);
  }

  // Also overwrite wrong fiat-panda if sports car was applied earlier — re-apply panda to all fiat pandas
  const pandaUrl = urlByKey.get("fiat-panda");
  if (pandaUrl) {
    const pandas = vehicles.filter(
      (v) =>
        v.make.toUpperCase().includes("FIAT") &&
        v.model.toUpperCase().includes("PANDA")
    );
    for (const v of pandas) {
      await prisma.vehicle.update({
        where: { id: v.id },
        data: { photos: [pandaUrl] },
      });
      console.log("FIX PANDA", v.plateNumber);
    }
  }

  const still = await prisma.vehicle.count({
    where: {
      organizationId: org.id,
      active: true,
      photos: { isEmpty: true },
    },
  });
  console.log(`\nUpdated ${updated}. Still missing: ${still}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
