// app/api/account/login/route.ts
import { NextRequest, NextResponse, after } from "next/server";
import { runCleanupIfDue } from "@/lib/cleanup";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signCustomerToken, CUSTOMER_COOKIE_NAME, CUSTOMER_COOKIE_OPTIONS } from "@/lib/customer-auth";
import { mergeGuestCartIntoUser } from "@/lib/cart";
import { rateLimit, isRateLimited, clientIp } from "@/lib/rate-limit";

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

  if (!email || !password) {
    return NextResponse.json({ error: "E-Mail und Passwort sind erforderlich." }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  // Only failed attempts count, per IP and per account (rotating IPs doesn't help
  // a guesser, and logging in often never locks a real customer out).
  const ipKey = `account-login:${clientIp(req)}`;
  const accountKey = `account-login-email:${normalizedEmail}`;
  if ((await isRateLimited(ipKey, 10)) || (await isRateLimited(accountKey, 10))) {
    return NextResponse.json({ error: "Zu viele fehlgeschlagene Anmeldeversuche. Bitte versuchen Sie es in 15 Minuten erneut." }, { status: 429 });
  }
  const failed = async () => {
    await Promise.all([rateLimit(ipKey, 10, 15 * 60_000), rateLimit(accountKey, 10, 15 * 60_000)]);
    return NextResponse.json({ error: "Ungültige E-Mail oder ungültiges Passwort." }, { status: 401 });
  };

  const rows = await prisma.$queryRaw<UserRow[]>`
    select u.id, u.email, u.password_hash, u.full_name, u.phone, a.role,
           (u.email_verified_at is not null) as email_verified
    from users u
    left join admin_users a on a.user_id = u.id
    where u.email = ${normalizedEmail} and u.deleted_at is null
    limit 1
  `;
  const user = rows[0];

  if (!user) return failed();

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return failed();

  // Fold whatever they'd added to cart before logging in into their account cart.
  const guestToken = req.cookies.get(GUEST_CART_COOKIE_NAME)?.value;
  if (guestToken) {
    await mergeGuestCartIntoUser(guestToken, user.id).catch((e: unknown) =>
      console.error("[cart] guest merge failed on login", e)
    );
  }

  const token = signCustomerToken({ userId: user.id, email: user.email });
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
