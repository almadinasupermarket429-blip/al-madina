import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { createPasswordReset } from "@/lib/password-reset";
import { sendPasswordResetEmail } from "@/lib/mailer";

// Always answers the same way whether or not the email has an account,
// so this can't be used to find out who's registered.
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!(await rateLimit(`forgot-password:${ip}`, 5, 15 * 60_000)).allowed) {
    return NextResponse.json({ error: "Zu viele Anfragen. Bitte versuchen Sie es später erneut." }, { status: 429 });
  }

  const { email } = await req.json().catch(() => ({}));
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Bitte geben Sie Ihre E-Mail-Adresse ein." }, { status: 400 });
  }
  const normalized = email.trim().toLowerCase();

  // Per-address cap too, so one inbox can't be flooded from rotating IPs.
  if ((await rateLimit(`forgot-password-email:${normalized}`, 3, 60 * 60_000)).allowed) {
    const rows = await prisma.$queryRaw<{ id: string; full_name: string; email: string }[]>`
      select id, full_name, email from users where email = ${normalized} and deleted_at is null limit 1
    `;
    const user = rows[0];
    if (user) {
      const token = await createPasswordReset(user.id);
      const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
      const url = `${origin}/account/reset-password?token=${encodeURIComponent(token)}`;
      after(async () => {
        await sendPasswordResetEmail(user.email, user.full_name, url).catch((e: unknown) =>
          console.error("[mailer] password reset email failed", e)
        );
      });
    }
  }

  return NextResponse.json({
    ok: true,
    message: "Falls ein Konto mit dieser E-Mail existiert, haben wir Ihnen einen Link zum Zurücksetzen gesendet.",
  });
}
