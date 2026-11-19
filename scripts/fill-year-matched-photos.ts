/**
 * Fill missing RELIABLE vehicle photos with year-matched Imagin Studio renders
 * (white paint, correct modelYear). Only for vehicles that still have no photos.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const prisma = new PrismaClient();
const TOKEN = "74965e12e3bc";
const cacheDir = join(process.cwd(), ".cache-assets", "fleet-year");

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

type Spec = {
  make: string;
  modelFamily: string;
  modelRange?: string;
};

function imaginSpec(make: string, model: string): Spec | null {
  const m = make.toUpperCase().replace(/\./g, "").trim();
  const mo = model.toUpperCase().replace(/\s+/g, " ").trim();

  if (m.includes("FIAT") && mo.includes("PANDA"))
    return { make: "fiat", modelFamily: "panda" };
  if (m.includes("FIAT") && mo.includes("500"))
    return { make: "fiat", modelFamily: "500", modelRange: "500c" };
  if (m.includes("FORD") && mo.includes("FIESTA"))
    return { make: "ford", modelFamily: "fiesta" };
  if (m.includes("MITSUBISHI") && mo.includes("SPACE"))
    return { make: "mitsubishi", modelFamily: "space-star" };
  if (m.includes("PEUGEOT") && mo.includes("208"))
    return { make: "peugeot", modelFamily: "208" };
  if (m.includes("SUZUKI") && mo.includes("SWIFT"))
    return { make: "suzuki", modelFamily: "swift" };
  if (m.includes("SUZUKI") && mo.includes("BALENO"))
    return { make: "suzuki", modelFamily: "baleno" };
  if (m.includes("NISSAN") && mo.includes("MICRA"))
    return { make: "nissan", modelFamily: "micra" };
  if (m.includes("NISSAN") && mo.includes("NOTE"))
    return { make: "nissan", modelFamily: "note" };
  if (m.includes("AUDI") && mo.includes("Q2"))
    return { make: "audi", modelFamily: "q2" };
  if (m.includes("TOYOTA") && mo.includes("YARIS"))
    return { make: "toyota", modelFamily: "yaris" };
  if (m.includes("VW") && /\bUP\b/.test(mo))
    return { make: "volkswagen", modelFamily: "up" };
  if (m.includes("VW") && mo.includes("PASSAT"))
    return { make: "volkswagen", modelFamily: "passat" };
  return null;
}

function imaginUrl(spec: Spec, year: number | null) {
  const y = year && year >= 2005 && year <= 2026 ? year : undefined;
  const params = new URLSearchParams({
    customer: "img",
    make: spec.make,
    modelFamily: spec.modelFamily,
    zoomType: "fullscreen",
    angle: "23",
    width: "1200",
    paintId: "pspc0016", // clean white / light
  });
  if (spec.modelRange) params.set("modelRange", spec.modelRange);
  if (y) params.set("modelYear", String(y));
  return `https://cdn.imagin.studio/getImage?${params.toString()}`;
}

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

  mkdirSync(cacheDir, { recursive: true });
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  const org = await prisma.organization.findUnique({
    where: { publicToken: TOKEN },
  });
  if (!org) throw new Error("org missing");

  const vehicles = await prisma.vehicle.findMany({
    where: { organizationId: org.id, active: true },
    select: {
      id: true,
      make: true,
      model: true,
      year: true,
      plateNumber: true,
      photos: true,
    },
  });

  const missing = vehicles.filter((v) => !v.photos?.length);
  console.log(`Need photos: ${missing.length}`);

  // Group by make|model|year so same photo reused
  const groups = new Map<string, typeof missing>();
  for (const v of missing) {
    const spec = imaginSpec(v.make, v.model);
    if (!spec) {
      console.log("NO SPEC", v.make, v.model);
      continue;
    }
    const key = `${spec.make}_${spec.modelFamily}_${v.year || "na"}`;
    const list = groups.get(key) || [];
    list.push(v);
    groups.set(key, list);
  }

  let updated = 0;
  for (const [groupKey, list] of groups) {
    const sample = list[0];
    const spec = imaginSpec(sample.make, sample.model)!;
    const url = imaginUrl(spec, sample.year);
    const local = join(cacheDir, `${groupKey}.jpg`);
    let buf: Buffer;
    if (existsSync(local) && readFileSync(local).length > 8000) {
      buf = readFileSync(local);
    } else {
      console.log("GET", groupKey, url);
      const res = await fetch(url);
      if (!res.ok) {
        console.log("FAIL", groupKey, res.status);
        continue;
      }
      buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 8000) {
        console.log("TOO SMALL", groupKey, buf.length);
        continue;
      }
      writeFileSync(local, buf);
    }

    const r2Key = `reliable/fleet/year/${groupKey}.jpg`;
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: r2Key,
        Body: buf,
        ContentType: "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    const publicUrl = `${process.env.R2_PUBLIC_BASE_URL!.replace(/\/$/, "")}/${r2Key}`;

    for (const v of list) {
      await prisma.vehicle.update({
        where: { id: v.id },
        data: { photos: [publicUrl] },
      });
      updated++;
      console.log(
        `OK ${v.make} ${v.model} ${v.year || "?"} (${v.plateNumber})`
      );
    }
  }

  console.log(`\nUpdated ${updated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
