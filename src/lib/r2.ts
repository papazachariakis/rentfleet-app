import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

let client: S3Client | null = null;

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_BASE_URL
  );
}

function r2Client(): S3Client {
  if (!isR2Configured()) {
    throw new Error("R2_NOT_CONFIGURED");
  }
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

export function r2Bucket(): string {
  return process.env.R2_BUCKET!;
}

export function r2Prefix(): string {
  return (process.env.R2_PREFIX || "rentfleet").replace(/^\/+|\/+$/g, "");
}

export function r2PublicBase(): string {
  return (
    process.env.R2_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ||
    ""
  ).replace(/\/$/, "");
}

export function r2PublicUrl(key: string): string {
  const base = r2PublicBase();
  if (!base) throw new Error("R2_PUBLIC_BASE_URL missing");
  return `${base}/${key.replace(/^\//, "")}`;
}

/** Από public URL → object key (αν ανήκει στο bucket μας). */
export function r2KeyFromPublicUrl(url: string): string | null {
  const base = r2PublicBase();
  if (!base || !url.startsWith(base + "/")) return null;
  return url.slice(base.length + 1);
}

export async function r2PutObject(input: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<string> {
  await r2Client().send(
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
    })
  );
  return r2PublicUrl(input.key);
}

export async function r2DeleteObject(key: string): Promise<void> {
  if (!key) return;
  try {
    await r2Client().send(
      new DeleteObjectCommand({
        Bucket: r2Bucket(),
        Key: key,
      })
    );
  } catch (err) {
    console.error("[r2] delete failed", key, err);
  }
}

export async function r2DeleteByPublicUrl(url: string): Promise<void> {
  const key = r2KeyFromPublicUrl(url);
  if (key) await r2DeleteObject(key);
}
