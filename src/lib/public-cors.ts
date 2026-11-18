import { NextResponse } from "next/server";

const DEFAULT_ORIGINS = [
  "https://reliable.drivemanager.gr",
  "https://www.auto-reliable.com",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
];

export function allowedPublicOrigins(): string[] {
  const extra = (process.env.PUBLIC_CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...DEFAULT_ORIGINS, ...extra];
}

export function isAllowedPublicOrigin(origin: string | null | undefined) {
  if (!origin) return false;
  return allowedPublicOrigins().includes(origin.replace(/\/$/, ""));
}

export function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
  if (origin && isAllowedPublicOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return headers;
}

export function withPublicCors(req: Request, res: NextResponse) {
  const headers = corsHeaders(req);
  for (const [k, v] of Object.entries(headers)) {
    res.headers.set(k, v);
  }
  return res;
}

export function publicOptions(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}
