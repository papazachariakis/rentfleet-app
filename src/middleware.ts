import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE = "rentfleet_session";

export function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/fleet/:path*",
    "/bookings/:path*",
    "/customers/:path*",
    "/calendar/:path*",
    "/tax/:path*",
    "/payments/:path*",
    "/branches/:path*",
    "/pricing/:path*",
    "/maintenance/:path*",
    "/reports/:path*",
    "/setup/:path*",
    "/guide/:path*",
    "/team/:path*",
    "/admin/:path*",
    "/branding/:path*",
    "/channels/:path*",
    "/map/:path*",
    "/telematics/:path*",
  ],
};
