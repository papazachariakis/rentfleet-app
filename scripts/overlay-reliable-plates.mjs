/**
 * Overlay Reliable logo onto license-plate regions of fleet photos that lack it.
 * Preserves original photo; composites the official yellow logo onto the plate.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "fs";
import { dirname, join, basename } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rfRoot = join(__dirname, "..");
const webRoot = join(rfRoot, "..", "RELIABLE RENT A CAR", "auto-reliable-web");
const logoPath = join(webRoot, ".cache-assets", "reliable_logo.png");
const scrapedDir = join(webRoot, "scripts", "scraped-fleet", "images");
const yearDir = join(rfRoot, ".cache-assets", "fleet-year");
const outDir = join(rfRoot, ".cache-assets", "plate-overlay");
mkdirSync(outDir, { recursive: true });

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

/**
 * Plate regions as fractions of image width/height: { left, top, width, height }
 * Tuned per photo by inspecting originals.
 */
const JOBS = [
  {
    src: join(scrapedDir, "fiat-panda.jpg"),
    r2Key: "reliable/fleet/fiat-panda.jpg",
    // "panda" vanity plate — front bumper (car faces left)
    plate: { left: 0.095, top: 0.585, width: 0.17, height: 0.072 },
  },
  {
    src: join(scrapedDir, "toyota-aygo.jpg"),
    r2Key: "reliable/fleet/toyota-aygo.jpg",
    // "AYGO" plate in X-grille
    plate: { left: 0.175, top: 0.495, width: 0.155, height: 0.07 },
  },
  {
    src: join(scrapedDir, "suzuki-ignis.jpg"),
    r2Key: "reliable/fleet/suzuki-ignis.jpg",
    // "IGNIS" plate — front right (car faces right)
    plate: { left: 0.78, top: 0.575, width: 0.175, height: 0.085 },
  },
  {
    src: join(scrapedDir, "fiat-500.jpg"),
    r2Key: "reliable/fleet/fiat-500.jpg",
    // rear Florida plate
    plate: { left: 0.14, top: 0.56, width: 0.13, height: 0.09 },
  },
  {
    src: join(yearDir, "audi_q2_2021.jpg"),
    r2Key: "reliable/fleet/audi-q2.jpg",
    plate: { left: 0.36, top: 0.485, width: 0.16, height: 0.068 },
    alsoUpdateUrl: true,
  },
  {
    src: join(yearDir, "volkswagen_up_2019.jpg"),
    r2Key: "reliable/fleet/volkswagen-up.jpg",
    plate: { left: 0.365, top: 0.488, width: 0.165, height: 0.07 },
    alsoUpdateUrl: true,
  },
];

async function overlayPlate(job) {
  const img = sharp(job.src);
  const meta = await img.metadata();
  const W = meta.width;
  const H = meta.height;
  const left = Math.round(job.plate.left * W);
  const top = Math.round(job.plate.top * H);
  const pw = Math.round(job.plate.width * W);
  const ph = Math.round(job.plate.height * H);

  // Yellow plate backing (covers old text) + logo fitted inside with small padding
  const pad = Math.max(2, Math.round(Math.min(pw, ph) * 0.04));
  const backing = await sharp({
    create: {
      width: pw,
      height: ph,
      channels: 3,
      background: { r: 255, g: 204, b: 0 },
    },
  })
    .png()
    .toBuffer();

  const logoFitted = await sharp(logoPath)
    .resize(pw - pad * 2, ph - pad * 2, { fit: "fill" })
    .png()
    .toBuffer();

  const plateBuf = await sharp(backing)
    .composite([{ input: logoFitted, left: pad, top: pad }])
    .png()
    .toBuffer();

  const outPath = join(outDir, basename(job.r2Key));
  await sharp(job.src)
    .composite([{ input: plateBuf, left, top }])
    .jpeg({ quality: 92 })
    .toFile(outPath);

  // Also write a crop preview of the plate area for visual QA
  const preview = join(outDir, `preview-${basename(job.r2Key)}`);
  await sharp(outPath)
    .extract({
      left: Math.max(0, left - 20),
      top: Math.max(0, top - 20),
      width: Math.min(W - left + 20, pw + 40),
      height: Math.min(H - top + 20, ph + 40),
    })
    .toFile(preview);

  console.log("OK", basename(job.src), `${W}x${H}`, `plate ${pw}x${ph}@${left},${top}`, "→", outPath);
  return outPath;
}

async function uploadR2(localPath, key) {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  const body = readFileSync(localPath);
  const ext = key.split(".").pop().toLowerCase();
  const ct = ext === "png" ? "image/png" : "image/jpeg";
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: ct,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  const base = process.env.R2_PUBLIC_BASE_URL.replace(/\/$/, "");
  return `${base}/${key}`;
}

async function main() {
  if (!existsSync(logoPath)) throw new Error("missing logo " + logoPath);
  const dry = process.argv.includes("--dry");
  const upload = process.argv.includes("--upload");

  const results = [];
  for (const job of JOBS) {
    if (!existsSync(job.src)) {
      console.warn("SKIP missing", job.src);
      continue;
    }
    const outPath = await overlayPlate(job);
    results.push({ job, outPath });
  }

  if (dry || !upload) {
    console.log("Done overlays. Re-run with --upload to push to R2 + DB.");
    return;
  }

  const prisma = new PrismaClient();
  const TOKEN = "74965e12e3bc";
  const org = await prisma.organization.findUnique({
    where: { publicToken: TOKEN },
  });

  for (const { job, outPath } of results) {
    // Also refresh local scraped copy for fleet that lives there
    if (job.src.includes("scraped-fleet")) {
      copyFileSync(outPath, job.src.replace(/\.(png|jpg|jpeg)$/i, ".jpg"));
      // keep original ext for r2 key
    }
    const url = await uploadR2(outPath, job.r2Key);
    console.log("uploaded", url);

    // Update vehicles/categories pointing at old path for this slug
    const slug = basename(job.r2Key);
    const vehicles = await prisma.vehicle.findMany({
      where: { organizationId: org.id },
    });
    for (const v of vehicles) {
      const photo = v.photos?.[0] || "";
      const file = photo.split("/").pop();
      const needs =
        file === slug ||
        (job.alsoUpdateUrl &&
          (file === "audi_q2_2021.jpg" ||
            file === "volkswagen_up_2019.jpg" ||
            (slug.includes("audi") && file?.includes("audi")) ||
            (slug.includes("volkswagen-up") && file?.includes("up"))));
      // Match by r2 key filename for fleet photos; special year names for Q2/Up
      let match = file === slug;
      if (slug === "audi-q2.jpg" && /audi.?q2|audi_q2/i.test(file || "")) match = true;
      if (slug === "volkswagen-up.jpg" && /volkswagen.?up|vw.?up|volkswagen_up/i.test(file || ""))
        match = true;
      if (!match) continue;
      await prisma.vehicle.update({
        where: { id: v.id },
        data: { photos: [url] },
      });
      console.log("vehicle", v.plateNumber, "→", slug);
    }

    const cats = await prisma.vehicleCategory.findMany({
      where: { organizationId: org.id },
    });
    for (const c of cats) {
      const file = (c.imageUrl || "").split("/").pop();
      let match = file === slug;
      if (slug === "audi-q2.jpg" && /audi.?q2|audi_q2/i.test(file || "")) match = true;
      if (slug === "volkswagen-up.jpg" && /volkswagen.?up|vw.?up|volkswagen_up/i.test(file || ""))
        match = true;
      // Also match by model name for aygo/panda/ignis/500
      if (
        /fiat-panda/.test(slug) && /panda/i.test(c.name) ||
        /toyota-aygo/.test(slug) && /aygo/i.test(c.name) ||
        /suzuki-ignis/.test(slug) && /ignis/i.test(c.name) ||
        /fiat-500/.test(slug) && /fiat.?500/i.test(c.name)
      ) {
        match = file?.includes(slug.replace(/\.(jpg|png)$/, "")) || match;
        if (c.imageUrl && c.imageUrl.includes(slug.replace(/\.(jpg|png)$/, ""))) match = true;
      }
      if (!match) continue;
      if (c.imageUrl === url) continue;
      // Only update if category image used this photo file
      const usedThis =
        file === slug ||
        (file && slug.replace(/\.(jpg|png)$/, "") === file.replace(/\.(jpg|png)$/, "")) ||
        (/audi_q2|audi-q2/.test(file || "") && slug.includes("audi-q2")) ||
        (/volkswagen_up|volkswagen-up|vw-up/.test(file || "") && slug.includes("volkswagen-up"));
      if (!usedThis && !(c.imageUrl || "").includes(slug.split(".")[0])) continue;
      await prisma.vehicleCategory.update({
        where: { id: c.id },
        data: { imageUrl: url },
      });
      console.log("category", c.name, "→", slug);
    }
  }

  // Refresh fleet-photos.json entries
  const photosPath = join(webRoot, "src", "lib", "fleet-photos.json");
  if (existsSync(photosPath)) {
    const photos = JSON.parse(readFileSync(photosPath, "utf8"));
    const base = process.env.R2_PUBLIC_BASE_URL.replace(/\/$/, "");
    for (const { job } of results) {
      const slug = basename(job.r2Key).replace(/\.(jpg|png)$/, "");
      const url = `${base}/${job.r2Key}`;
      const hit = photos.find((p) => p.slug === slug || p.key === job.r2Key);
      if (hit) {
        hit.url = url;
        hit.key = job.r2Key;
      } else if (job.alsoUpdateUrl) {
        photos.push({ slug, url, key: job.r2Key });
      }
    }
    writeFileSync(photosPath, JSON.stringify(photos.sort((a, b) => a.slug.localeCompare(b.slug)), null, 2) + "\n");
    console.log("updated fleet-photos.json");
  }

  await prisma.$disconnect();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
