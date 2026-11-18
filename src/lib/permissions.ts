import type { SessionUser } from "@/lib/session";

/** Ρόλοι membership οργανισμού */
export type OrgRole = "ADMIN" | "DESK" | "VIEWER";

export function normalizeRole(role?: string | null): OrgRole {
  if (role === "ADMIN" || role === "OWNER") return "ADMIN";
  if (role === "VIEWER") return "VIEWER";
  if (role === "DESK" || role === "STAFF") return "DESK";
  return "DESK";
}

export function isAdmin(session: SessionUser | null | undefined) {
  return normalizeRole(session?.role) === "ADMIN";
}

export function canWriteOps(session: SessionUser | null | undefined) {
  const r = normalizeRole(session?.role);
  return r === "ADMIN" || r === "DESK";
}

export function canManageSettings(session: SessionUser | null | undefined) {
  return isAdmin(session);
}

export function canManageTeam(session: SessionUser | null | undefined) {
  return isAdmin(session);
}

export const ROLE_LABELS: Record<OrgRole, string> = {
  ADMIN: "Διαχειριστής",
  DESK: "Γκισέ / ops",
  VIEWER: "Μόνο ανάγνωση",
};
