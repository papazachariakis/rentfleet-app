import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function keyFromEnv() {
  const secret = process.env.AUTH_SECRET || "dev-secret-change-me";
  return createHash("sha256").update(secret).digest();
}

/** AES-256-GCM · αποθήκευση secrets στο DB χωρίς plain text. */
export function sealSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFromEnv(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${enc.toString("base64url")}`;
}

export function openSecret(sealed: string | null | undefined): string | null {
  if (!sealed) return null;
  if (!sealed.startsWith("v1:")) return sealed;
  const [, ivB64, tagB64, dataB64] = sealed.split(":");
  if (!ivB64 || !tagB64 || !dataB64) return null;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      keyFromEnv(),
      Buffer.from(ivB64, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64url")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

export function maskSecret(value: string | null | undefined) {
  if (!value) return null;
  const plain = openSecret(value) || value;
  if (plain.length < 8) return "••••";
  return `${plain.slice(0, 7)}…${plain.slice(-4)}`;
}
