/**
 * Sync Auto Reliable website fleet (auto-reliable.com) into RentFleet:
 * - upload photos to R2 (reliable/fleet/*)
 * - upsert named VehicleCategory rows with seats/rates/transmission/description
 * - deactivate legacy CAT.* categories for public catalog
 * - ensure ≥1 AVAILABLE vehicle per new category
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
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
loadEnvFile(join(rfRoot, ".env.local"));

const TOKEN = process.env.RELIABLE_PUBLIC_TOKEN || "74965e12e3bc";
const DEPOSIT = 450;

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

function transmissionOf(fuel) {
  const f = (fuel || "").toLowerCase();
  if (f.includes("automatic")) return "Automatic";
  if (f.includes("manual")) return "Manual";
  if (f.includes("cabriolet")) return "Manual";
  return null;
}

function vehicleTypeOf(car) {
  if ((car.seats || 0) >= 8 || /traveller|bus|minibus/i.test(car.name))
    return "VAN";
  if ((car.seats || 0) >= 7 || /caddy|lodgy|stepway/i.test(car.name))
    return "VAN";
  return "CAR";
}

function extOf(url) {
  const m = url.match(/\.(jpe?g|png|webp)(?:\?|$)/i);
  return (m?.[1] || "jpg").toLowerCase().replace("jpeg", "jpg");
}

async function download(url, dest) {
  if (existsSync(dest)) return dest;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 ReliableFleetSync/1.0" },
  });
  if (!res.ok) throw new Error(`download ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  return dest;
}

async function uploadR2(localPath, key, contentType) {
  const body = readFileSync(localPath);
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  const base = (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  return `${base}/${key}`;
}

async function main() {
  const org = await prisma.organization.findUnique({
    where: { publicToken: TOKEN },
  });
  if (!org) throw new Error("Organization not found for token");

  console.log("Org:", org.name, org.id);
  console.log("Cars:", fleet.length);

  const photoIndex = [];

  for (const car of fleet) {
    const slug = car.slug || slugify(car.name);
    const ext = extOf(car.imageUrl || "x.jpg");
    const local = join(cacheDir, `${slug}.${ext}`);
    let imageUrl = null;
    if (car.imageUrl) {
      try {
        await download(car.imageUrl, local);
        const key = `reliable/fleet/${slug}.${ext}`;
        const ct =
          ext === "png"
            ? "image/png"
            : ext === "webp"
              ? "image/webp"
              : "image/jpeg";
        imageUrl = await uploadR2(local, key, ct);
        photoIndex.push({ slug, url: imageUrl, key });
        console.log("photo", slug, "→", imageUrl);
      } catch (e) {
        console.warn("photo fail", slug, e.message);
      }
    }

    const fuel = car.fuel || "";
    const description = [
      fuel,
      car.bags != null ? `${car.bags} bags` : null,
      car.doors != null ? `${car.doors} doors` : null,
      car.ac ? "A/C" : null,
      "Include VAT",
      "Unlimited kilometers",
      "Full Insurance",
    ]
      .filter(Boolean)
      .join(" · ");

    const transmission = transmissionOf(fuel);
    const vehicleType = vehicleTypeOf(car);
    const rate = Number(car.dailyRate) || 40;

    const existing = await prisma.vehicleCategory.findFirst({
      where: {
        organizationId: org.id,
        name: { equals: car.name, mode: "insensitive" },
      },
    });

    let category;
    if (existing) {
      category = await prisma.vehicleCategory.update({
        where: { id: existing.id },
        data: {
          name: car.name,
          vehicleType,
          description,
          baseDailyRate: rate,
          depositAmount: DEPOSIT,
          seats: car.seats || null,
          transmission,
          imageUrl: imageUrl || existing.imageUrl,
          active: true,
        },
      });
      console.log("update category", category.name);
    } else {
      category = await prisma.vehicleCategory.create({
        data: {
          name: car.name,
          vehicleType,
          description,
          baseDailyRate: rate,
          depositAmount: DEPOSIT,
          seats: car.seats || null,
          transmission,
          imageUrl,
          active: true,
          organizationId: org.id,
        },
      });
      console.log("create category", category.name);
    }

    const vehicles = await prisma.vehicle.findMany({
      where: { organizationId: org.id, categoryId: category.id, active: true },
    });
    if (vehicles.length === 0) {
      const makeModel = car.name.replace(/\s+or similar$/i, "").trim();
      const parts = makeModel.split(/\s+/);
      const make = parts[0] || "Car";
      const model = parts.slice(1).join(" ") || makeModel;
      const plate = `WEB-${slug.slice(0, 10).toUpperCase()}-${String(
        Math.floor(Math.random() * 90 + 10),
      )}`;
      await prisma.vehicle.create({
        data: {
          plateNumber: plate,
          make,
          model,
          year: null,
          vehicleType,
          status: "AVAILABLE",
          fuelType: fuel.includes("Diesel")
            ? "Diesel"
            : fuel.includes("Hybrid")
              ? "Hybrid"
              : "Petrol",
          photos: imageUrl ? [imageUrl] : [],
          notes: "Synced from auto-reliable.com reservation catalog",
          active: true,
          categoryId: category.id,
          organizationId: org.id,
        },
      });
      console.log("  + vehicle", plate);
    } else if (imageUrl) {
      for (const v of vehicles) {
        if (!v.photos?.length) {
          await prisma.vehicle.update({
            where: { id: v.id },
            data: { photos: [imageUrl] },
          });
        }
      }
    }
  }

  // Hide legacy desk codes from public catalog (named models are the website fleet)
  const deactivated = await prisma.vehicleCategory.updateMany({
    where: {
      organizationId: org.id,
      active: true,
      name: { startsWith: "CAT." },
    },
    data: { active: false },
  });
  console.log("deactivated CAT.* categories:", deactivated.count);

  writeFileSync(
    join(webRoot, "src", "lib", "fleet-photos.json"),
    JSON.stringify(photoIndex.sort((a, b) => a.slug.localeCompare(b.slug)), null, 2) +
      "\n",
  );
  console.log("wrote fleet-photos.json", photoIndex.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
