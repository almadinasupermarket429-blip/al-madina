import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { signAdminToken, ADMIN_COOKIE_NAME } from "@/lib/auth";
import { rateLimit, isRateLimited, clientIp } from "@/lib/rate-limit";

/** Constant-time string comparison so a wrong-length/wrong-content guess can't be timed. */
function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

interface AdminUserRow {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: "OWNER" | "STAFF";
}

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({ username: "", password: "" }));

  if (!username || !password) {
    return NextResponse.json({ error: "Ungültiger Benutzername oder ungültiges Passwort." }, { status: 401 });
  }

  const normalizedEmail = username.trim().toLowerCase();
  // Only failed attempts count, per IP and per account (rotating IPs doesn't help
  // a guesser, and a busy admin logging in often never gets locked out).
  const ipKey = `admin-login:${clientIp(req)}`;
  const accountKey = `admin-login-user:${normalizedEmail}`;
  if ((await isRateLimited(ipKey, 10)) || (await isRateLimited(accountKey, 10))) {
    return NextResponse.json({ error: "Zu viele fehlgeschlagene Anmeldeversuche. Bitte versuchen Sie es in 15 Minuten erneut." }, { status: 429 });
  }
  const failed = async () => {
    await Promise.all([rateLimit(ipKey, 10, 15 * 60_000), rateLimit(accountKey, 10, 15 * 60_000)]);
    return NextResponse.json({ error: "Ungültiger Benutzername oder ungültiges Passwort." }, { status: 401 });
  };

  // 1. admin_users is a role marker on top of users (user_id, role) — the
  // actual credentials (email, password_hash, full_name) live in users.
  // This is the same shared-login join getAdminSession() uses in lib/auth.ts.
  const rows = await prisma.$queryRaw<AdminUserRow[]>`
    SELECT
      u.id,
      u.email,
      u.password_hash as "passwordHash",
      u.full_name as "fullName",
      a.role
    FROM users u
    JOIN admin_users a ON a.user_id = u.id
    WHERE u.email = ${normalizedEmail} AND u.deleted_at IS NULL
    LIMIT 1
  `;
  const account = rows[0];

  if (account) {
    const valid = await bcrypt.compare(password, account.passwordHash);
    if (!valid) return failed();

    const token = await signAdminToken({
      username: account.email,
      role: account.role,
      adminId: account.id
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE_NAME, token, ADMIN_COOKIE_OPTIONS);
    return res;
  }

  // 2. Fall back to the .env super-admin (always OWNER). Disabled entirely if
  // either var isn't set — no "admin"/"admin" default to fall through to.
  const validUsername = process.env.ADMIN_USERNAME;
  const validPassword = process.env.ADMIN_PASSWORD;

  if (
    !validUsername ||
    !validPassword ||
    !safeEqual(username, validUsername) ||
    !safeEqual(password, validPassword)
  ) {
    return failed();
  }

  const token = await signAdminToken({ username, role: "OWNER", adminId: null });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, token, ADMIN_COOKIE_OPTIONS);
  return res;
}