/**
 * For RELIABLE vehicles without photos, download free model images,
 * upload to R2, and attach to matching vehicles.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
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
loadEnvFile(join(process.cwd(), ".env.local"));
loadEnvFile(join(process.cwd(), ".env"));

/** Free Wikimedia / Unsplash sources for missing models */
const SOURCES: { key: string; match: (make: string, model: string) => boolean; urls: string[] }[] = [
  {
    key: "fiat-panda",
    match: (m, mo) => m.includes("FIAT") && mo.includes("PANDA"),
    urls: [
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/2018_Fiat_Panda_Easy_1.2.jpg/1280px-2018_Fiat_Panda_Easy_1.2.jpg",
      "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    key: "fiat-500",
    match: (m, mo) => m.includes("FIAT") && mo.includes("500"),
    urls: [
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Fiat_500_Cabrio_1.2_8V_Lounge_%28III%29_%E2%80%93_Frontansicht%2C_14._April_2012%2C_D%C3%BCsseldorf.jpg/1280px-Fiat_500_Cabrio_1.2_8V_Lounge_%28III%29_%E2%80%93_Frontansicht%2C_14._April_2012%2C_D%C3%BCsseldorf.jpg",
    ],
  },
  {
    key: "ford-fiesta",
    match: (m, mo) => m.includes("FORD") && mo.includes("FIESTA"),
    urls: [
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/2018_Ford_Fiesta_Zetec_1.0.jpg/1280px-2018_Ford_Fiesta_Zetec_1.0.jpg",
    ],
  },
  {
    key: "mitsubishi-space-star",
    match: (m, mo) => m.includes("MITSUBISHI") && mo.includes("SPACE"),
    urls: [
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Mitsubishi_Space_Star_%28seit_2020%29_IMG_4119.jpg/1280px-Mitsubishi_Space_Star_%28seit_2020%29_IMG_4119.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/2016_Mitsubishi_Space_Star_1.2.jpg/1280px-2016_Mitsubishi_Space_Star_1.2.jpg",
    ],
  },
  {
    key: "peugeot-208",
    match: (m, mo) => m.includes("PEUGEOT") && mo.includes("208"),
    urls: [
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Peugeot_208_II_IMG_3801.jpg/1280px-Peugeot_208_II_IMG_3801.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/2019_Peugeot_208_Allure_1.2.jpg/1280px-2019_Peugeot_208_Allure_1.2.jpg",
    ],
  },
  {
    key: "suzuki-swift",
    match: (m, mo) => m.includes("SUZUKI") && mo.includes("SWIFT"),
    urls: [
      "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/2017_Suzuki_Swift_SZ5_Boosterjet_1.0_Front.jpg/1280px-2017_Suzuki_Swift_SZ5_Boosterjet_1.0_Front.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Suzuki_Swift_%28FACELIFT%29_IMG_4948.jpg/1280px-Suzuki_Swift_%28FACELIFT%29_IMG_4948.jpg",
    ],
  },
  {
    key: "suzuki-baleno",
    match: (m, mo) => m.includes("SUZUKI") && mo.includes("BALENO"),
    urls: [
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/2016_Suzuki_Baleno_1.0_Boosterjet_SZ5.jpg/1280px-2016_Suzuki_Baleno_1.0_Boosterjet_SZ5.jpg",
    ],
  },
  {
    key: "nissan-micra",
    match: (m, mo) => m.includes("NISSAN") && mo.includes("MICRA"),
    urls: [
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/2017_Nissan_Micra_Acenta_DIG-T_0.9_Front.jpg/1280px-2017_Nissan_Micra_Acenta_DIG-T_0.9_Front.jpg",
    ],
  },
  {
    key: "nissan-note",
    match: (m, mo) => m.includes("NISSAN") && mo.includes("NOTE"),
    urls: [
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/2014_Nissan_Note_Acenta_Premium_Dig-S_1.2_Front.jpg/1280px-2014_Nissan_Note_Acenta_Premium_Dig-S_1.2_Front.jpg",
    ],
  },
  {
    key: "audi-q2",
    match: (m, mo) => m.includes("AUDI") && mo.includes("Q2"),
    urls: [
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Audi_Q2_1.4_TFSI_quattro_S_line_%28Facelift%29_%E2%80%93_f_01012021.jpg/1280px-Audi_Q2_1.4_TFSI_quattro_S_line_%28Facelift%29_%E2%80%93_f_01012021.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Audi_Q2_IMG_0875.jpg/1280px-Audi_Q2_IMG_0875.jpg",
    ],
  },
  {
    key: "toyota-yaris",
    match: (m, mo) => m.includes("TOYOTA") && mo.includes("YARIS"),
    urls: [
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/2020_Toyota_Yaris_Design_HEV_CVT_1.5_Front.jpg/1280px-2020_Toyota_Yaris_Design_HEV_CVT_1.5_Front.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Toyota_Yaris_Hybrid_%28XP210%29_IMG_4075.jpg/1280px-Toyota_Yaris_Hybrid_%28XP210%29_IMG_4075.jpg",
    ],
  },
  {
    key: "vw-up",
    match: (m, mo) => (m.includes("VW") || m.includes("V.W") || m === "V W") && mo.includes("UP"),
    urls: [
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/VW_up%21_1.0_%28Facelift%29_%E2%80%93_Frontansicht%2C_5._September_2012%2C_D%C3%BCsseldorf.jpg/1280px-VW_up%21_1.0_%28Facelift%29_%E2%80%93_Frontansicht%2C_5._September_2012%2C_D%C3%BCsseldorf.jpg",
    ],
  },
  {
    key: "vw-passat",
    match: (m, mo) =>
      (m.includes("VW") || m.includes("V.W") || m === "V W") && mo.includes("PASSAT"),
    urls: [
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/VW_Passat_B8_Limousine_2.0_TDI_Highline_%E2%80%93_Frontansicht%2C_5._September_2015%2C_D%C3%BCsseldorf.jpg/1280px-VW_Passat_B8_Limousine_2.0_TDI_Highline_%E2%80%93_Frontansicht%2C_5._September_2015%2C_D%C3%BCsseldorf.jpg",
    ],
  },
];

async function downloadFirst(key: string, urls: string[]): Promise<{ buf: Buffer; contentType: string }> {
  mkdirSync(cacheDir, { recursive: true });
  const local = join(cacheDir, key);
  if (existsSync(local)) {
    const buf = readFileSync(local);
    const isPng = buf[0] === 0x89;
    return { buf, contentType: isPng ? "image/png" : "image/jpeg" };
  }
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "RentFleetPhotoBot/1.0 (fleet fill; local ops)" },
        redirect: "follow",
      });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 5000) continue;
      writeFileSync(local, buf);
      const ct = res.headers.get("content-type") || "image/jpeg";
      console.log(`  downloaded ${key} (${buf.length}b) from ${url.slice(0, 80)}…`);
      return { buf, contentType: ct.split(";")[0] };
    } catch (e) {
      console.log(`  fail ${url.slice(0, 60)}`, e instanceof Error ? e.message : e);
    }
  }
  throw new Error(`No image for ${key}`);
}

async function main() {
  const required = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "R2_PUBLIC_BASE_URL",
  ];
  for (const k of required) {
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

  const org = await prisma.organization.findUnique({
    where: { publicToken: TOKEN },
  });
  if (!org) throw new Error("org not found");

  const vehicles = await prisma.vehicle.findMany({
    where: { organizationId: org.id, active: true },
    select: { id: true, make: true, model: true, plateNumber: true, photos: true },
  });

  const missing = vehicles.filter((v) => !v.photos?.length);
  console.log(`Missing photos: ${missing.length}/${vehicles.length}`);

  const urlByKey = new Map<string, string>();

  for (const src of SOURCES) {
    const needed = missing.some((v) =>
      src.match(v.make.toUpperCase(), v.model.toUpperCase())
    );
    if (!needed) continue;
    console.log(`Fetching ${src.key}…`);
    const { buf, contentType } = await downloadFirst(src.key, src.urls);
    const ext = contentType.includes("png") ? "png" : "jpg";
    const key = `reliable/fleet/${src.key}.${ext}`;
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: key,
        Body: buf,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    const publicUrl = `${process.env.R2_PUBLIC_BASE_URL!.replace(/\/$/, "")}/${key}`;
    urlByKey.set(src.key, publicUrl);
    console.log(`  uploaded ${publicUrl}`);
  }

  let updated = 0;
  for (const v of missing) {
    const make = v.make.toUpperCase().replace(/\./g, "");
    const model = v.model.toUpperCase();
    const src = SOURCES.find((s) => s.match(make, model));
    if (!src) {
      console.log(`NO SOURCE ${v.make} ${v.model}`);
      continue;
    }
    const url = urlByKey.get(src.key);
    if (!url) continue;
    await prisma.vehicle.update({
      where: { id: v.id },
      data: { photos: [url] },
    });
    updated++;
    console.log(`OK ${v.make} ${v.model} (${v.plateNumber}) → ${src.key}`);
  }

  console.log(`\nUpdated ${updated} vehicles`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
