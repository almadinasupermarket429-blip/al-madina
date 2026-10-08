import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { consumeReset, findValidReset } from "@/lib/password-reset";

// GET ?token= — lets the page tell the user up front if their link is dead.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const userId = token ? await findValidReset(token) : null;
  return NextResponse.json({ valid: Boolean(userId) });
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!(await rateLimit(`reset-password:${ip}`, 10, 15 * 60_000)).allowed) {
    return NextResponse.json({ error: "Zu viele Versuche. Bitte versuchen Sie es später erneut." }, { status: 429 });
  }

  const { token, password } = await req.json().catch(() => ({}));
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Ungültiger Link." }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Das Passwort muss mindestens 8 Zeichen lang sein." }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 10);
  const userId = await consumeReset(token, hash);
  if (!userId) {
    return NextResponse.json({ error: "Dieser Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
