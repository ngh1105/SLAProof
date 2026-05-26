import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/cases", "/receipt"];
const ROOT_PROTECTED = true;

function attachRequestId(res: NextResponse, requestId: string): NextResponse {
  res.headers.set("x-request-id", requestId);
  return res;
}

function generateRequestId(): string {
  // Crypto.randomUUID is available in the edge runtime.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function middleware(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? generateRequestId();
  const expected = process.env.PILOT_TOKEN;
  if (!expected) return attachRequestId(NextResponse.next(), requestId);

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/_next") || pathname.startsWith("/api/health") || pathname.startsWith("/api/csp-report") || pathname === "/favicon.ico") {
    return attachRequestId(NextResponse.next(), requestId);
  }

  const isRoot = pathname === "/";
  const isProtected =
    (ROOT_PROTECTED && isRoot) || PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return attachRequestId(NextResponse.next(), requestId);

  const token = req.cookies.get("pilot_token")?.value;
  if (token === expected) return attachRequestId(NextResponse.next(), requestId);

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return attachRequestId(NextResponse.redirect(url), requestId);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
