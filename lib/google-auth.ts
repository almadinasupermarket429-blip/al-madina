import { decodeJwt } from "jose";

/**
 * "Sign in with Google" (OpenID Connect, authorization-code flow with PKCE).
 * No Google script is loaded on our pages: the browser only talks to Google
 * after the visitor clicks the button, so nothing reaches Google beforehand.
 */

export const GOOGLE_STATE_COOKIE = "almadina_google_state";

export function googleLoginEnabled(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** Only same-site paths, so the login can't be used to redirect people elsewhere. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/account";
  return next;
}

export function redirectUri(origin: string): string {
  return `${origin}/api/account/google/callback`;
}

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export function randomToken(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export function googleAuthUrl(origin: string, state: string, challenge: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export type GoogleProfile = { email: string; name: string };

/**
 * Swaps the one-time code for Google's ID token. The token comes straight from
 * Google's token endpoint over TLS, so (per OpenID Connect) its claims can be
 * trusted without a separate signature check; we still confirm who it was issued for.
 */
export async function fetchGoogleProfile(origin: string, code: string, verifier: string): Promise<GoogleProfile | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!res.ok) {
    console.error("[google] token exchange failed", res.status, await res.text().catch(() => ""));
    return null;
  }
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) return null;

  const claims = decodeJwt(id_token);
  const issuerOk = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  if (!issuerOk || claims.aud !== process.env.GOOGLE_CLIENT_ID) return null;
  // Only addresses Google has confirmed belong to this person.
  if (claims.email_verified !== true || typeof claims.email !== "string") return null;

  const email = claims.email.trim().toLowerCase();
  const name = typeof claims.name === "string" && claims.name.trim() ? claims.name.trim() : email.split("@")[0];
  return { email, name: name.slice(0, 120) };
}
