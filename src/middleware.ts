import { NextResponse, type NextRequest } from "next/server";

import { canAccessOpsRoutes } from "@/lib/auth/ops-access";
import { parseSessionCookieValue } from "@/lib/auth/session-cookie";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/member" || pathname.startsWith("/member/")) {
    return new NextResponse(null, { status: 404 });
  }
  if (!pathname.startsWith("/ops")) {
    return NextResponse.next();
  }

  const session = parseSessionCookieValue(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );
  if (!canAccessOpsRoutes(session)) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/member", "/member/:path*", "/ops/:path*"],
};
