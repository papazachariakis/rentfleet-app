import type { SessionUser } from "@/lib/session";

/** Platform administrators — μπορούν να μπουν σε οποιονδήποτε λογαριασμό */
const DEFAULT_ADMINS = ["papazachariakis@gmail.com"];

export function platformAdminEmails(): string[] {
  const fromEnv = (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ADMINS, ...fromEnv])];
}

export function isPlatformAdminEmail(email?: string | null) {
  if (!email) return false;
  return platformAdminEmails().includes(email.toLowerCase());
}

export function isPlatformAdmin(session: SessionUser | null | undefined) {
  if (!session) return false;
  if (session.platformAdmin) return true;
  if (session.realEmail && isPlatformAdminEmail(session.realEmail)) return true;
  return isPlatformAdminEmail(session.email);
}
