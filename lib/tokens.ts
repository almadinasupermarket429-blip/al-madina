import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { JWT_SECRET } from "./jwt-secret";

// One JWT library for the whole app (jose also runs in the edge middleware).
// HS256 matches the tokens issued before, so existing sessions stay valid.
const key = new TextEncoder().encode(JWT_SECRET);

export function signToken(claims: Record<string, unknown>, expiresIn: string): Promise<string> {
  return new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(expiresIn).sign(key);
}

/** Returns the payload if the signature and expiry are valid, otherwise null. */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    return payload;
  } catch {
    return null;
  }
}
