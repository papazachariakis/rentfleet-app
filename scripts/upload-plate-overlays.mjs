/**
 * Upload existing .cache-assets/plate-overlay/*.jpg to R2 and refresh Reliable DB URLs.
 * Does not regenerate overlays.
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "fs";
import { dirname, join, basename } from "path";
import { fileURLToPath } from "url";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rfRoot = join(__dirname, "..");
const webRoot = join(rfRoot, "..", "RELIABLE RENT A CAR", "auto-reliable-web");
const outDir = join(rfRoot, ".cache-assets", "plate-overlay");
const scrapedDir = join(webRoot, "scripts", "scraped-fleet", "images");
const TOKEN = "74965e12e3bc";
const CACHE_BUST = "reliable-plate-1";

function loadEnv(p) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}
loadEnv(join(rfRoot, ".env"));
loadEnv(join(webRoot, ".env.local"));
loadEnv(join(rfRoot, "..", "AMMOUDI", ".env.local"));

const JOBS = [
  { file: "fiat-panda.jpg", r2Key: "reliable/fleet/fiat-panda.jpg", scraped: true },
  { file: "toyota-aygo.jpg", r2Key: "reliable/fleet/toyota-aygo.jpg", scraped: true },
  { file: "suzuki-ignis.jpg", r2Key: "reliable/fleet/suzuki-ignis.jpg", scraped: true },
  { file: "fiat-500.jpg", r2Key: "reliable/fleet/fiat-500.jpg", scraped: true },
  {
    file: "audi-q2.jpg",
    r2Key: "reliable/fleet/audi-q2.jpg",
    matchPhoto: (f) => /audi.?q2|audi_q2/i.test(f || ""),
  },
  {
    file: "volkswagen-up.jpg",
    r2Key: "reliable/fleet/volkswagen-up.jpg",
    matchPhoto: (f) => /volkswagen.?up|vw.?up|volkswagen_up/i.test(f || ""),
  },
];

function fileOfUrl(u) {
  return (u || "").split("?")[0].split("/").pop() || "";
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

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  const base = process.env.R2_PUBLIC_BASE_URL.replace(/\/$/, "");
  const prisma = new PrismaClient();
  const org = await prisma.organization.findUnique({ where: { publicToken: TOKEN } });
  if (!org) throw new Error("org not found");

  const vehicles = await prisma.vehicle.findMany({ where: { organizationId: org.id } });
  const cats = await prisma.vehicleCategory.findMany({ where: { organizationId: org.id } });

  for (const job of JOBS) {
    const localPath = join(outDir, job.file);
    if (!existsSync(localPath)) {
      console.warn("SKIP missing", localPath);
      continue;
    }

    if (job.scraped) {
      const scrapedPath = join(scrapedDir, job.file);
      if (existsSync(dirname(scrapedPath))) {
        copyFileSync(localPath, scrapedPath);
      }
    }

    const body = readFileSync(localPath);
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: job.r2Key,
        Body: body,
        ContentType: "image/jpeg",
        CacheControl: "public, max-age=86400",
      })
    );
    const url = `${base}/${job.r2Key}?v=${CACHE_BUST}`;
    console.log("uploaded", url);

    const slug = basename(job.r2Key);
    for (const v of vehicles) {
      const file = fileOfUrl(v.photos?.[0]);
      let match = file === slug;
      if (job.matchPhoto?.(file)) match = true;
      if (!match) continue;
      await prisma.vehicle.update({
        where: { id: v.id },
        data: { photos: [url] },
      });
      console.log("  vehicle", v.plateNumber || v.id, "→", slug);
    }

    for (const c of cats) {
      const file = fileOfUrl(c.imageUrl);
      let match = file === slug;
      if (job.matchPhoto?.(file)) match = true;
      if (
        /fiat-panda/.test(slug) && /panda/i.test(c.name) ||
        /toyota-aygo/.test(slug) && /aygo/i.test(c.name) ||
        /suzuki-ignis/.test(slug) && /ignis/i.test(c.name) ||
        /fiat-500/.test(slug) && /500/i.test(c.name) && /fiat/i.test(c.name)
      ) {
        if ((c.imageUrl || "").includes(slug.replace(/\.jpg$/, ""))) match = true;
      }
      if (!match) continue;
      await prisma.vehicleCategory.update({
        where: { id: c.id },
        data: { imageUrl: url },
      });
      console.log("  category", c.name, "→", slug);
    }
  }

  const photosPath = join(webRoot, "src", "lib", "fleet-photos.json");
  if (existsSync(photosPath)) {
    const photos = JSON.parse(readFileSync(photosPath, "utf8"));
    for (const job of JOBS) {
      const slug = basename(job.r2Key).replace(/\.jpg$/, "");
      const url = `${base}/${job.r2Key}?v=${CACHE_BUST}`;
      let hit = photos.find((p) => p.slug === slug || p.key === job.r2Key);
      if (!hit && /audi-q2/.test(slug)) {
        hit = photos.find((p) => /audi.?q2|audi_q2/i.test(p.slug || "") || /audi.?q2|audi_q2/i.test(p.key || ""));
      }
      if (!hit && /volkswagen-up/.test(slug)) {
        hit = photos.find(
          (p) =>
            /volkswagen.?up|vw.?up|volkswagen_up/i.test(p.slug || "") ||
            /volkswagen.?up|vw.?up|volkswagen_up/i.test(p.key || "")
        );
      }
      if (hit) {
        hit.url = url;
        hit.key = job.r2Key;
        hit.slug = slug;
      } else {
        photos.push({ slug, url, key: job.r2Key });
      }
    }
    writeFileSync(
      photosPath,
      JSON.stringify(
        photos.sort((a, b) => String(a.slug).localeCompare(String(b.slug))),
        null,
        2
      ) + "\n"
    );
    console.log("updated fleet-photos.json");
  }

  await prisma.$disconnect();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
