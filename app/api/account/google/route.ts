import { NextRequest, NextResponse } from "next/server";
import { GOOGLE_STATE_COOKIE, googleAuthUrl, googleLoginEnabled, pkceChallenge, randomToken, safeNextPath } from "@/lib/google-auth";

/** Starts "Sign in with Google": remembers a one-time state, then sends the visitor to Google. */
export async function GET(req: NextRequest) {
  if (!googleLoginEnabled()) {
    return NextResponse.redirect(new URL("/account?google=unavailable", req.url));
  }

  const state = randomToken();
  const verifier = randomToken();
  const next = safeNextPath(req.nextUrl.searchParams.get("next"));

  const res = NextResponse.redirect(googleAuthUrl(req.nextUrl.origin, state, await pkceChallenge(verifier)));
  res.cookies.set(GOOGLE_STATE_COOKIE, JSON.stringify({ state, verifier, next }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // sent along when Google redirects back
    path: "/api/account/google",
    maxAge: 10 * 60,
  });
  return res;
}
