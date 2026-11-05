// app/api/account/login/route.ts
import { NextRequest, NextResponse, after } from "next/server";
import { runCleanupIfDue } from "@/lib/cleanup";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signCustomerToken, CUSTOMER_COOKIE_NAME, CUSTOMER_COOKIE_OPTIONS } from "@/lib/customer-auth";
import { mergeGuestCartIntoUser } from "@/lib/cart";
import { rateLimit, resetRateLimit, refundRateLimit, clientIp } from "@/lib/rate-limit";
import { DUMMY_PASSWORD_HASH } from "@/lib/dummy-hash";

const GUEST_CART_COOKIE_NAME = "almadina_guest_cart";

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  phone: string | null;
  role: "OWNER" | "STAFF" | null;
  email_verified: boolean;
};

export async function POST(req: NextRequest) {
  // Housekeeping: delete personal data past its retention period (runs at most every 6 h).
  after(runCleanupIfDue);
  const body = await req.json().catch(() => ({}));
  const { email, password } = body as { email?: string; password?: string };

  if (typeof email !== "string" || typeof password !== "string" || !email || !password || email.length > 254 || password.length > 200) {
    return NextResponse.json({ error: "E-Mail und Passwort sind erforderlich." }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  // Every attempt counts before the password is checked, so parallel guesses can't slip
  // past the limit. A correct password clears the per-account counter.
  const ipKey = `account-login:${clientIp(req)}`;
  const accountKey = `account-login-email:${normalizedEmail}`;
  const [byIp, byAccount] = await Promise.all([
    rateLimit(ipKey, 20, 15 * 60_000),
    rateLimit(accountKey, 10, 15 * 60_000),
  ]);
  if (!byIp.allowed || !byAccount.allowed) {
    return NextResponse.json({ error: "Zu viele fehlgeschlagene Anmeldeversuche. Bitte versuchen Sie es in 15 Minuten erneut." }, { status: 429 });
  }
  const failed = () => NextResponse.json({ error: "Ungültige E-Mail oder ungültiges Passwort." }, { status: 401 });

  const rows = await prisma.$queryRaw<UserRow[]>`
    select u.id, u.email, u.password_hash, u.full_name, u.phone, a.role,
           (u.email_verified_at is not null) as email_verified
    from users u
    left join admin_users a on a.user_id = u.id
    where u.email = ${normalizedEmail} and u.deleted_at is null
    limit 1
  `;
  const user = rows[0];

  // Always run one bcrypt check so the response time doesn't reveal whether the email has an account.
  const valid = await bcrypt.compare(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
  if (!user || !valid) return failed();
  await Promise.all([resetRateLimit(accountKey), refundRateLimit(ipKey)]);

  // Fold whatever they'd added to cart before logging in into their account cart.
  const guestToken = req.cookies.get(GUEST_CART_COOKIE_NAME)?.value;
  if (guestToken) {
    await mergeGuestCartIntoUser(guestToken, user.id).catch((e: unknown) =>
      console.error("[cart] guest merge failed on login", e)
    );
  }

  const token = await signCustomerToken({ userId: user.id, email: user.email });
  const res = NextResponse.json({
    id: user.id,
    name: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    emailVerified: user.email_verified,
  });
  res.cookies.set(CUSTOMER_COOKIE_NAME, token, CUSTOMER_COOKIE_OPTIONS);
  if (guestToken) res.cookies.delete(GUEST_CART_COOKIE_NAME);
  return res;
}
