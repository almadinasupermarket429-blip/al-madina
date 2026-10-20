import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/tokens";

// Keep these in sync with ADMIN_COOKIE_NAME / CUSTOMER_COOKIE_NAME in lib/auth.ts / lib/customer-auth.ts
const ADMIN_COOKIE_NAME = "almadina_admin_session";
const CUSTOMER_COOKIE_NAME = "almadina_customer_session";

const OWNER_ONLY_PREFIXES = [
  "/admin/products",
  "/admin/analytics",
  "/admin/team",
  "/admin/settings",
  "/admin/coupons",
  "/admin/customers",
  "/admin/reviews",
  "/admin/categories",
];

const isDev = process.env.NODE_ENV !== "production";

/**
 * Per-request Content-Security-Policy. Scripts run only if they carry this
 * request's nonce (Next.js adds it to its own scripts automatically) — so an
 * injected <script> can't execute, unlike with 'unsafe-inline'. Dev mode also
 * needs 'unsafe-eval' for webpack's hot reloading.
 */
function contentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://res.cloudinary.com",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

/**
 * Cross-site request check for API writes. Session cookies are SameSite=Lax,
 * which already stops most cross-site POSTs; this also refuses any write whose
 * Origin header names a different site (browsers always send Origin on
 * cross-site POST/PUT/PATCH/DELETE).
 */
function isCrossSiteWrite(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return false;
  const origin = req.headers.get("origin");
  if (!origin) return false; // non-browser clients (curl, server-to-server) don't send it
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host !== host;
  } catch {
    return true; // "null" or garbage origin
  }
}

/** Admin pages: redirects to the login (or to /admin for owner-only pages), or null to continue. */
async function adminGate(req: NextRequest): Promise<NextResponse | null> {
  const { pathname } = req.nextUrl;
  const adminToken = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const customerToken = req.cookies.get(CUSTOMER_COOKIE_NAME)?.value;

  // Admin cookie from /admin/login: its role is in the token, so owner-only
  // pages can be gated right here (the API re-checks against the database).
  // Customer tokens share the secret — only a token minted by /admin/login counts here.
  const adminPayload = adminToken ? await verifyToken(adminToken) : null;
  if (adminPayload?.typ === "admin") {
    const isOwnerOnlyPage = OWNER_ONLY_PREFIXES.some((p) => pathname.startsWith(p));
    if (isOwnerOnlyPage && adminPayload.role !== "OWNER") {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    return null;
  }

  // Shared login path: this only confirms a valid customer session exists.
  // Whether that customer is actually an admin (and which role) needs a
  // database lookup — that happens in getAdminSession(), used by every
  // admin API route and by AdminShell's own /api/admin/me check on
  // mount, which redirects to /admin/login if the answer is "no."
  if (customerToken && (await verifyToken(customerToken))) return null;

  return NextResponse.redirect(new URL("/admin/login", req.url));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (isCrossSiteWrite(req)) {
      return NextResponse.json({ error: "Anfrage von einer fremden Website abgelehnt." }, { status: 403 });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const redirect = await adminGate(req);
    if (redirect) return redirect;
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  // Next.js reads the nonce from the request's CSP header and stamps it on its scripts;
  // the root layout reads x-nonce for its own (JSON-LD) script tags.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  // Everything except static build assets and public files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png|notification.wav).*)"],
};
