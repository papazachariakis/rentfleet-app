import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "rentfleet_session";
const secret = () =>
  new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret");

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
  organizationName: string;
  impersonating?: boolean;
  platformAdmin?: boolean;
  /** Πραγματικός admin όταν γίνεται impersonation */
  realUserId?: string;
  realEmail?: string;
  realName?: string;
  realRole?: string;
  realOrganizationId?: string;
  realOrganizationName?: string;
};

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}
