// app/api/account/register/route.ts
//
// Email-first sign-up. The answer is the same whether or not the email already
// has an account ({ pending: true } — "enter the code we emailed you"), so this
// endpoint can't be used to find out who shops here:
//   - new email: the account is created unverified and a 6-digit code is sent.
//     No session yet — POST /api/account/verify-email with { email, code } logs in.
//   - existing email: nothing changes; the owner gets an "you already have an
//     account" email with login and password-reset links instead.
import { NextRequest, NextResponse, after } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { isDisposableEmail } from "@/lib/disposable-email";
import { isPlausiblePhoneNumber } from "@/lib/phone";
import { createEmailVerification } from "@/lib/email-verification";
import { sendAccountExistsEmail, sendVerificationEmail } from "@/lib/mailer";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!(await rateLimit(`register:${ip}`, 5, 60_000)).allowed) {
    return NextResponse.json({ error: "Zu viele Versuche. Bitte versuchen Sie es in einer Minute erneut." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const { name, email, password, phone } = body as {
    name?: string;
    email?: string;
    password?: string;
    phone?: string;
  };

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, E-Mail und Passwort sind erforderlich." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Das Passwort muss mindestens 8 Zeichen lang sein." }, { status: 400 });
  }
  if (isDisposableEmail(email)) {
    return NextResponse.json(
      { error: "Bitte verwenden Sie eine dauerhafte E-Mail-Adresse — temporäre Wegwerf-Adressen werden nicht akzeptiert." },
      { status: 400 }
    );
  }
  if (phone && !isPlausiblePhoneNumber(phone)) {
    return NextResponse.json({ error: "Bitte geben Sie eine gültige Telefonnummer ein." }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  // Hash up front on both paths so response time doesn't reveal which one ran.
  const passwordHash = await bcrypt.hash(password, 10);
  const pending = NextResponse.json({ pending: true, email: normalizedEmail });

  const existing = await prisma.$queryRaw<{ id: string; full_name: string }[]>`
    select id, full_name from users where email = ${normalizedEmail} limit 1
  `;
  if (existing[0]) {
    const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
    after(async () => {
      // At most a few notices per address per hour, so this can't be used to spam someone.
      if (!(await rateLimit(`account-exists-mail:${normalizedEmail}`, 2, 60 * 60_000)).allowed) return;
      await sendAccountExistsEmail(
        normalizedEmail,
        existing[0].full_name,
        `${origin}/account`,
        `${origin}/account?forgot=1`
      ).catch((e: unknown) => console.error("[mailer] account-exists email failed", e));
    });
    return pending;
  }

  // Account creation, code and email run after the response is sent, so a new
  // address doesn't answer measurably slower than an existing one.
  after(async () => {
    const created = await prisma.$queryRaw<{ id: string; full_name: string }[]>`
      insert into users (email, password_hash, full_name, phone)
      values (${normalizedEmail}, ${passwordHash}, ${name.trim()}, ${phone?.trim() || null})
      on conflict (email) do nothing
      returning id, full_name
    `;
    const user = created[0];
    if (!user) return; // lost a race with a simultaneous sign-up for the same address
    const code = await createEmailVerification(user.id);
    await sendVerificationEmail(normalizedEmail, user.full_name, code).catch((e: unknown) =>
      console.error("[mailer] verification email failed", e)
    );
  });
  return pending;
}
