import { NextRequest, NextResponse, after } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { createEmailVerification } from "@/lib/email-verification";
import { sendVerificationEmail } from "@/lib/mailer";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

// Sends a fresh verification code — to the logged-in customer, or (during
// sign-up, before there is a session) to { email }. In the sign-up case the
// answer is always { ok: true }, so it can't be used to probe for accounts.
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  // Per-IP cap, independent of account, to slow down anyone cycling addresses.
  if (!(await rateLimit(`resend-verification-ip:${ip}`, 10, 10 * 60_000)).allowed) {
    return NextResponse.json({ error: "Bitte warten Sie kurz, bevor Sie einen weiteren Code anfordern." }, { status: 429 });
  }

  const session = await getCustomerSession();
  const { email } = session ? { email: session.email } : await req.json().catch(() => ({ email: undefined }));
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  const normalizedEmail = email.trim().toLowerCase();

  if (!(await rateLimit(`resend-verification:${normalizedEmail}`, 3, 10 * 60_000)).allowed) {
    return NextResponse.json({ error: "Bitte warten Sie kurz, bevor Sie einen weiteren Code anfordern." }, { status: 429 });
  }

  const rows = await prisma.$queryRaw<{ id: string; full_name: string; verified: boolean }[]>`
    select id, full_name, (email_verified_at is not null) as verified
    from users where email = ${normalizedEmail} and deleted_at is null limit 1
  `;
  const user = rows[0];

  if (session && user?.verified) {
    return NextResponse.json({ error: "Diese E-Mail ist bereits bestätigt." }, { status: 400 });
  }
  if (user && !user.verified) {
    const code = await createEmailVerification(user.id);
    after(async () => {
      await sendVerificationEmail(normalizedEmail, user.full_name, code).catch((e: unknown) =>
        console.error("[mailer] resend verification email failed", e)
      );
    });
  }
  return NextResponse.json({ ok: true });
}
