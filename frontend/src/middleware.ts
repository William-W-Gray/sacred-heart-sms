import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = new Set(["/login"]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasToken = !!request.cookies.get("sms_access")?.value;

  // Root: redirect based on auth state
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(hasToken ? "/dashboard" : "/login", request.url),
    );
  }

  // Protected route without token → login
  if (!PUBLIC_PATHS.has(pathname) && !hasToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Already authenticated → skip login page
  if (pathname === "/login" && hasToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next.js internals and static assets
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|api).*)"],
};
