import type { NextRequest } from "next/server";
import { createHash } from "crypto";
import { prisma } from "./prisma";

// Rate limiter for auth-adjacent endpoints (login, register, password reset,
// coupon checks, order tracking) — slows down brute-force/credential-stuffing
// and enumeration. Counters live in Postgres (table rate_limits), so the limit
// holds across every server instance, not per process. Keys are hashed, so
// no emails or IPs are stored in plain text.

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const hashed = createHash("sha256").update(key).digest("hex");
  const resetAt = new Date(Date.now() + windowMs);
  try {
    // One atomic statement: start a new window if the old one expired, otherwise count up.
    const rows = await prisma.$queryRaw<{ count: number; reset_at: Date }[]>`
      insert into rate_limits (key, count, reset_at) values (${hashed}, 1, ${resetAt})
      on conflict (key) do update set
        count = case when rate_limits.reset_at <= now() then 1 else rate_limits.count + 1 end,
        reset_at = case when rate_limits.reset_at <= now() then excluded.reset_at else rate_limits.reset_at end
      returning count, reset_at
    `;
    // Occasionally sweep expired counters so the table stays small.
    if (Math.random() < 0.01) {
      await prisma.$executeRaw`delete from rate_limits where reset_at < now()`;
    }
    const { count, reset_at } = rows[0];
    if (count > limit) return { allowed: false, retryAfterMs: new Date(reset_at).getTime() - Date.now() };
    return { allowed: true, retryAfterMs: 0 };
  } catch (err) {
    // Fail open: a limiter hiccup must not lock every customer out of logging in.
    console.error("[rate-limit] check failed", err);
    return { allowed: true, retryAfterMs: 0 };
  }
}

/**
 * True if `key` has already used up `limit` in its current window — without
 * counting this call. Used for "failed attempts only" limits: check with this
 * first, and call rateLimit() only when an attempt actually fails.
 */
export async function isRateLimited(key: string, limit: number): Promise<boolean> {
  const hashed = createHash("sha256").update(key).digest("hex");
  try {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      select count from rate_limits where key = ${hashed} and reset_at > now()
    `;
    return (rows[0]?.count ?? 0) >= limit;
  } catch (err) {
    console.error("[rate-limit] check failed", err);
    return false;
  }
}

/**
 * Best-effort client IP for rate-limit keys.
 *
 * `x-forwarded-for` is client-settable on any request that doesn't pass
 * through a proxy that overwrites it, so a client can spoof a fresh value
 * per request and get a brand-new rate-limit bucket every time — defeating
 * the whole point. So, in order of trust:
 *  - `x-vercel-forwarded-for`: set by Vercel's edge network, not client-settable.
 *  - `x-real-ip`: overwritten by nginx / most reverse proxies.
 *  - the LAST `x-forwarded-for` entry: the one appended by the nearest proxy
 *    (a client can only prepend fake entries, not replace that one).
 * With no proxy in front at all, every header is client-controlled — which is
 * why login/password routes also rate-limit per account, not just per IP.
 */
export function clientIp(req: NextRequest): string {
  const vercel = req.headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return req.headers.get("x-forwarded-for")?.split(",").pop()?.trim() || "unknown";
}
