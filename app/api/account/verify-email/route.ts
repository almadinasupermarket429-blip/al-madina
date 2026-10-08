import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession, signCustomerToken, CUSTOMER_COOKIE_NAME, CUSTOMER_COOKIE_OPTIONS } from "@/lib/customer-auth";
import { verifyEmailCode } from "@/lib/email-verification";
import { mergeGuestCartIntoUser } from "@/lib/cart";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const GUEST_CART_COOKIE_NAME = "almadina_guest_cart";

// Two callers:
//  - a logged-in customer confirming their address ({ code }), and
//  - a new sign-up finishing registration ({ email, code }) — no session yet;
//    a correct code logs them in. Answers in this mode never reveal whether
//    the email has an account (one generic error for every failure).
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!(await rateLimit(`verify-email:${ip}`, 10, 60_000)).allowed) {
    return NextResponse.json({ error: "Zu viele Versuche. Bitte versuchen Sie es in einer Minute erneut." }, { status: 429 });
  }

  const { code, email } = await req.json().catch(() => ({}));
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Geben Sie den 6-stelligen Code aus Ihrer E-Mail ein." }, { status: 400 });
  }

  const session = await getCustomerSession();
  if (session) {
    const result = await verifyEmailCode(session.userId, code);
    switch (result) {
      case "OK":
        return NextResponse.json({ ok: true });
      case "NO_PENDING_CODE":
        return NextResponse.json({ error: "Kein Bestätigungscode aktiv — fordern Sie einen neuen an." }, { status: 400 });
      case "EXPIRED":
        return NextResponse.json({ error: "Dieser Code ist abgelaufen — fordern Sie einen neuen an." }, { status: 400 });
      case "TOO_MANY_ATTEMPTS":
        return NextResponse.json({ error: "Zu viele falsche Versuche — fordern Sie einen neuen Code an." }, { status: 429 });
      case "INVALID":
        return NextResponse.json({ error: "Falscher Code. Bitte versuchen Sie es erneut." }, { status: 400 });
    }
  }

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!(await rateLimit(`verify-email-address:${normalizedEmail}`, 10, 15 * 60_000)).allowed) {
    return NextResponse.json({ error: "Zu viele Versuche. Bitte versuchen Sie es später erneut." }, { status: 429 });
  }

  const rows = await prisma.$queryRaw<
    { id: string; email: string; full_name: string; phone: string | null; role: "OWNER" | "STAFF" | null }[]
  >`
    select u.id, u.email, u.full_name, u.phone, a.role
    from users u left join admin_users a on a.user_id = u.id
    where u.email = ${normalizedEmail} and u.deleted_at is null
    limit 1
  `;
  const user = rows[0];
  const result = user ? await verifyEmailCode(user.id, code) : "INVALID";
  if (!user || result !== "OK") {
    return NextResponse.json(
      { error: "Der Code ist falsch oder abgelaufen. Fordern Sie bei Bedarf einen neuen an." },
      { status: 400 }
    );
  }

  // Fold whatever they'd added to the basket before signing up into the new account.
  const guestToken = req.cookies.get(GUEST_CART_COOKIE_NAME)?.value;
  if (guestToken) {
    await mergeGuestCartIntoUser(guestToken, user.id).catch((e: unknown) =>
      console.error("[cart] guest merge failed on sign-up", e)
    );
  }

  const res = NextResponse.json({
    id: user.id,
    name: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    emailVerified: true,
  });
  res.cookies.set(CUSTOMER_COOKIE_NAME, signCustomerToken({ userId: user.id, email: user.email }), CUSTOMER_COOKIE_OPTIONS);
  if (guestToken) res.cookies.delete(GUEST_CART_COOKIE_NAME);
  return res;
}
