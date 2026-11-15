import type { NextRequest } from "next/server";

const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

/**
 * The shop's public origin, for canonical links, the sitemap, social previews and email links.
 * NEXT_PUBLIC_SITE_URL wins, except that a deployed build ignores a localhost value (easily copied
 * from .env into Vercel, which once made every canonical link and email button point at
 * localhost:3000) and uses Vercel's production domain instead. null when nothing usable is known.
 */
export function configuredSiteUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") || "";
  const deployed = Boolean(process.env.VERCEL_ENV);
  if (configured && !(deployed && LOCAL.test(configured))) return configured;
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim().replace(/\/+$/, "");
  if (deployed && production) return `https://${production}`;
  return configured || null;
}

/** Same as configuredSiteUrl(), with the local dev server as the last resort (metadata needs a URL). */
export function siteUrl(): string {
  return configuredSiteUrl() ?? "http://localhost:3000";
}

/**
 * Origin for links in emails (password reset, account notices). In production only the configured
 * origin is used: the request's own origin comes from the Host / X-Forwarded-Host headers, so a
 * forged request could make a reset email link to someone else's site. Returns null (and logs)
 * when production has no site URL, so callers send nothing rather than a bad link.
 */
export function emailLinkOrigin(req: NextRequest): string | null {
  const configured = configuredSiteUrl();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return req.nextUrl.origin;
  console.error("[site-url] NEXT_PUBLIC_SITE_URL is not set: email links are not sent");
  return null;
}
