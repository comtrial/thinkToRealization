import { NextRequest, NextResponse } from "next/server";
import { unsealData } from "iron-session";
import { sessionOptions } from "@/lib/auth/session";

const PUBLIC_PATHS = ["/login", "/register"];
const PUBLIC_API_PATHS = ["/api/auth/login", "/api/auth/register", "/api/test/"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip auth in test environment (next dev overrides NODE_ENV to 'development')
  if (process.env.NODE_ENV === "test" || process.env.BYPASS_AUTH === "true") {
    return NextResponse.next();
  }

  // Allow public pages
  if (PUBLIC_PATHS.some((p) => pathname === p)) {
    return NextResponse.next();
  }

  // Allow public API routes
  if (PUBLIC_API_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // Check session cookie
  const cookie = req.cookies.get(sessionOptions.cookieName);
  if (!cookie?.value) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다", status: 401 } },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Validate cookie payload
  try {
    const session = await unsealData<{ userId?: string }>(cookie.value, {
      password: sessionOptions.password,
    });
    if (!session.userId) throw new Error("no userId");
  } catch {
    // Invalid or expired session
    const response = pathname.startsWith("/api/")
      ? NextResponse.json(
          { error: { code: "UNAUTHORIZED", message: "세션이 만료되었습니다", status: 401 } },
          { status: 401, headers: { "Cache-Control": "no-store" } }
        )
      : NextResponse.redirect(new URL("/login", req.url));
    response.cookies.delete(sessionOptions.cookieName);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
