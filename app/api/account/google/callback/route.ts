import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signCustomerToken, CUSTOMER_COOKIE_NAME, CUSTOMER_COOKIE_OPTIONS } from "@/lib/customer-auth";
import { mergeGuestCartIntoUser } from "@/lib/cart";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { GOOGLE_STATE_COOKIE, fetchGoogleProfile, googleLoginEnabled, safeNextPath } from "@/lib/google-auth";

const GUEST_CART_COOKIE_NAME = "almadina_guest_cart";

type UserRow = { id: string; email: string; verified: boolean };

/** Google sends the visitor back here. Logs into the matching account, or creates one. */
export async function GET(req: NextRequest) {
  const fail = (reason: string) => {
    const res = NextResponse.redirect(new URL(`/account?google=${reason}`, req.url));
    res.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: "/api/account/google" });
    return res;
  };

  if (!googleLoginEnabled()) return fail("unavailable");
  if (!(await rateLimit(`google-login:${clientIp(req)}`, 20, 15 * 60_000)).allowed) return fail("error");

  const params = req.nextUrl.searchParams;
  if (params.get("error")) return fail("cancelled"); // e.g. the visitor pressed "Cancel" at Google

  let saved: { state?: string; verifier?: string; next?: string } = {};
  try {
    saved = JSON.parse(req.cookies.get(GOOGLE_STATE_COOKIE)?.value ?? "{}");
  } catch {
    // treated as missing below
  }
  const code = params.get("code");
  if (!code || !saved.state || !saved.verifier || params.get("state") !== saved.state) return fail("error");

  const profile = await fetchGoogleProfile(req.nextUrl.origin, code, saved.verifier).catch((e: unknown) => {
    console.error("[google] sign-in failed", e);
    return null;
  });
  if (!profile) return fail("error");

  const existing = await prisma.$queryRaw<UserRow[]>`
    select id, email, (email_verified_at is not null) as verified
    from users where email = ${profile.email} and deleted_at is null limit 1
  `;
  let user = existing[0];

  if (user && !user.verified) {
    // Someone signed up with this address but never confirmed it. Google has now proven who
    // owns it, so confirm it and switch off that unconfirmed password: it may not be theirs.
    const unusablePassword = await bcrypt.hash(crypto.randomUUID() + crypto.randomUUID(), 10);
    await prisma.$executeRaw`
      update users set email_verified_at = now(), password_hash = ${unusablePassword}, password_changed_at = now()
      where id = ${user.id}::uuid
    `;
  }

  if (!user) {
    // New customer: no password of their own (they sign in with Google, or can set one via "forgot password").
    const unusablePassword = await bcrypt.hash(crypto.randomUUID() + crypto.randomUUID(), 10);
    const created = await prisma.$queryRaw<UserRow[]>`
      insert into users (email, password_hash, full_name, email_verified_at)
      values (${profile.email}, ${unusablePassword}, ${profile.name}, now())
      on conflict (email) do nothing
      returning id, email, true as verified
    `;
    user = created[0];
    if (!user) return fail("error"); // lost a race with a simultaneous sign-up
  }

  const guestToken = req.cookies.get(GUEST_CART_COOKIE_NAME)?.value;
  if (guestToken) {
    await mergeGuestCartIntoUser(guestToken, user.id).catch((e: unknown) => console.error("[cart] guest merge failed on Google login", e));
  }

  const token = await signCustomerToken({ userId: user.id, email: user.email });
  const res = NextResponse.redirect(new URL(safeNextPath(saved.next), req.url));
  res.cookies.set(CUSTOMER_COOKIE_NAME, token, CUSTOMER_COOKIE_OPTIONS);
  res.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: "/api/account/google" });
  if (guestToken) res.cookies.delete(GUEST_CART_COOKIE_NAME);
  return res;
}
