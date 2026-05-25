import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/cases", "/receipt"];
const ROOT_PROTECTED = true;

export function middleware(req: NextRequest) {
  const expected = process.env.PILOT_TOKEN;
  if (!expected) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/_next") || pathname.startsWith("/api/health") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  const isRoot = pathname === "/";
  const isProtected =
    (ROOT_PROTECTED && isRoot) || PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get("pilot_token")?.value;
  if (token === expected) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
