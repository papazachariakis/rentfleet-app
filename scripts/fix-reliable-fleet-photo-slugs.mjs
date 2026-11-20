/** Re-upload fleet photos with name-based slugs and refresh category.imageUrl */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rfRoot = join(__dirname, "..");
const webRoot = join(rfRoot, "..", "RELIABLE RENT A CAR", "auto-reliable-web");
const fleetPath = join(webRoot, "scripts", "scraped-fleet", "fleet.json");
const cacheDir = join(webRoot, "scripts", "scraped-fleet", "images");
mkdirSync(cacheDir, { recursive: true });

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
const fleet = JSON.parse(readFileSync(fleetPath, "utf8"));
const prisma = new PrismaClient();
const client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/or similar/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function extOf(url) {
  const m = url.match(/\.(jpe?g|png|webp)(?:\?|$)/i);
  return (m?.[1] || "jpg").toLowerCase().replace("jpeg", "jpg");
}

async function download(url, dest) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 ReliableFleetSync/1.0" },
  });
  if (!res.ok) throw new Error(`download ${res.status}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  const org = await prisma.organization.findUnique({
    where: { publicToken: TOKEN },
  });
  if (!org) throw new Error("no org");

  const photoIndex = [];
  for (const car of fleet) {
    const slug = slugify(car.name);
    const ext = extOf(car.imageUrl || "x.jpg");
    const local = join(cacheDir, `${slug}.${ext}`);
    await download(car.imageUrl, local);
    const key = `reliable/fleet/${slug}.${ext}`;
    const ct =
      ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: readFileSync(local),
        ContentType: ct,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    const url = `${process.env.R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
    photoIndex.push({ slug, url, key });

    const cat = await prisma.vehicleCategory.findFirst({
      where: {
        organizationId: org.id,
        name: { equals: car.name, mode: "insensitive" },
      },
    });
    if (cat) {
      await prisma.vehicleCategory.update({
        where: { id: cat.id },
        data: { imageUrl: url },
      });
      await prisma.vehicle.updateMany({
        where: { organizationId: org.id, categoryId: cat.id },
        data: { photos: [url] },
      });
    }
    console.log(car.name, "→", url);
  }

  writeFileSync(
    join(webRoot, "src", "lib", "fleet-photos.json"),
    JSON.stringify(
      photoIndex.sort((a, b) => a.slug.localeCompare(b.slug)),
      null,
      2,
    ) + "\n",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
