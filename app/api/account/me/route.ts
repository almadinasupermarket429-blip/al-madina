// app/api/account/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCustomerSession, signCustomerToken, CUSTOMER_COOKIE_NAME, CUSTOMER_COOKIE_OPTIONS } from "@/lib/customer-auth";
import { isPlausiblePhoneNumber } from "@/lib/phone";
import { rateLimit, clientIp } from "@/lib/rate-limit";

type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "OWNER" | "STAFF" | null;
  emailVerified: boolean;
};

async function loadUser(userId: string): Promise<UserRow | null> {
  const rows = await prisma.$queryRaw<UserRow[]>`
    select u.id, u.full_name as "name", u.email, u.phone, a.role, (u.email_verified_at is not null) as "emailVerified"
    from users u
    left join admin_users a on a.user_id = u.id
    where u.id = ${userId}::uuid and u.deleted_at is null
  `;
  return rows[0] ?? null;
}

export async function GET() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ user: null });
  return NextResponse.json({ user: await loadUser(session.userId) });
}

// Update profile (name, phone) and/or change password (requires the current one).
export async function PATCH(req: NextRequest) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { name, phone, currentPassword, newPassword } = body as Record<string, string | undefined>;

  if (newPassword !== undefined) {
    if (
      !(await rateLimit(`change-password:${clientIp(req)}`, 10, 15 * 60_000)).allowed ||
      !(await rateLimit(`change-password-user:${session.userId}`, 5, 15 * 60_000)).allowed
    ) {
      return NextResponse.json({ error: "Zu viele Versuche. Bitte versuchen Sie es später erneut." }, { status: 429 });
    }
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json({ error: "Das neue Passwort muss mindestens 8 Zeichen lang sein." }, { status: 400 });
    }
    const rows = await prisma.$queryRaw<{ password_hash: string }[]>`
      select password_hash from users where id = ${session.userId}::uuid
    `;
    if (!currentPassword || !rows[0] || !(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
      return NextResponse.json({ error: "Das aktuelle Passwort ist falsch." }, { status: 400 });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    // password_changed_at ends every other session (see getCustomerSession).
    await prisma.$executeRaw`update users set password_hash = ${hash}, password_changed_at = now() where id = ${session.userId}::uuid`;
  }

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim() || name.length > 120) {
      return NextResponse.json({ error: "Bitte geben Sie einen gültigen Namen ein." }, { status: 400 });
    }
    await prisma.$executeRaw`update users set full_name = ${name.trim()} where id = ${session.userId}::uuid`;
  }
  if (phone !== undefined) {
    if (phone && !isPlausiblePhoneNumber(phone)) {
      return NextResponse.json({ error: "Bitte geben Sie eine gültige Telefonnummer ein." }, { status: 400 });
    }
    await prisma.$executeRaw`update users set phone = ${phone?.trim() || null} where id = ${session.userId}::uuid`;
  }

  const res = NextResponse.json({ user: await loadUser(session.userId) });
  // Keep this device logged in with a session issued after the password change.
  if (newPassword !== undefined) {
    res.cookies.set(CUSTOMER_COOKIE_NAME, signCustomerToken(session), CUSTOMER_COOKIE_OPTIONS);
  }
  return res;
}

/**
 * Delete account (GDPR Art. 17). Requires the current password.
 *
 * Personal data on the account is erased: name, email, phone, password, addresses,
 * wishlist, cart, reviews and pending codes. Past orders are kept, because German tax
 * and commercial law requires business records for 6–10 years (§ 147 AO, § 257 HGB);
 * they stay linked to an anonymous placeholder account that can no longer sign in.
 */
export async function DELETE(req: NextRequest) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  if (!(await rateLimit(`delete-account-user:${session.userId}`, 5, 15 * 60_000)).allowed) {
    return NextResponse.json({ error: "Zu viele Versuche. Bitte versuchen Sie es später erneut." }, { status: 429 });
  }

  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  const rows = await prisma.$queryRaw<{ password_hash: string; role: string | null }[]>`
    select u.password_hash, a.role from users u left join admin_users a on a.user_id = u.id
    where u.id = ${session.userId}::uuid and u.deleted_at is null
  `;
  const user = rows[0];
  if (!user) return NextResponse.json({ error: "Konto nicht gefunden." }, { status: 404 });
  if (!password || !(await bcrypt.compare(password, user.password_hash))) {
    return NextResponse.json({ error: "Das Passwort ist falsch." }, { status: 400 });
  }
  if (user.role) {
    return NextResponse.json(
      { error: "Dieses Konto hat Zugang zur Verwaltung. Bitte entfernen Sie zuerst den Zugang im Team-Bereich." },
      { status: 409 }
    );
  }

  const open = await prisma.$queryRaw<{ n: bigint }[]>`
    select count(*) as n from orders where user_id = ${session.userId}::uuid and status not in ('DELIVERED', 'CANCELLED')
  `;
  if (Number(open[0]?.n ?? 0) > 0) {
    return NextResponse.json(
      { error: "Sie haben noch eine offene Bestellung. Sie können Ihr Konto löschen, sobald sie geliefert oder storniert ist." },
      { status: 409 }
    );
  }

  const unusablePassword = await bcrypt.hash(crypto.randomUUID() + crypto.randomUUID(), 10);
  await prisma.$transaction([
    prisma.$executeRaw`delete from addresses where user_id = ${session.userId}::uuid`,
    prisma.$executeRaw`delete from wishlists where user_id = ${session.userId}::uuid`,
    prisma.$executeRaw`delete from reviews where user_id = ${session.userId}::uuid`,
    prisma.$executeRaw`delete from carts where user_id = ${session.userId}::uuid`,
    prisma.$executeRaw`delete from email_verifications where user_id = ${session.userId}::uuid`,
    prisma.$executeRaw`delete from password_resets where user_id = ${session.userId}::uuid`,
    prisma.$executeRaw`
      update users set
        email = ${`deleted-${session.userId}@deleted.invalid`},
        full_name = 'Gelöschtes Konto',
        phone = null,
        password_hash = ${unusablePassword},
        password_changed_at = now(),
        email_verified_at = null,
        deleted_at = now()
      where id = ${session.userId}::uuid
    `,
  ]);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(CUSTOMER_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}
