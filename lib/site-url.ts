import type { NextRequest } from "next/server";

/**
 * Origin for links in emails (password reset, account notices). In production only the configured
 * NEXT_PUBLIC_SITE_URL is used: the request's own origin comes from the Host / X-Forwarded-Host
 * headers, so a forged request could make a reset email link to someone else's site. Returns null
 * (and logs) when production has no site URL, so callers send nothing rather than a bad link.
 */
export function emailLinkOrigin(req: NextRequest): string | null {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return req.nextUrl.origin;
  console.error("[site-url] NEXT_PUBLIC_SITE_URL is not set: email links are not sent");
  return null;
}
