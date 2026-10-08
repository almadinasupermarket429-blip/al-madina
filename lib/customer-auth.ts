import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { JWT_SECRET } from "./jwt-secret";
import { prisma } from "./prisma";

const COOKIE_NAME = "almadina_customer_session";
const SECRET = JWT_SECRET;

export type CustomerTokenPayload = {
  userId: string;
  email: string;
  iat?: number;
};

export function signCustomerToken(payload: CustomerTokenPayload) {
  return jwt.sign({ userId: payload.userId, email: payload.email, typ: "customer" }, SECRET, { expiresIn: "60d" });
}

/**
 * Signature check only. Admin tokens are signed with the same secret, so a
 * token is accepted here only if it actually carries a customer userId and
 * isn't marked as an admin token.
 */
function verifyCustomerToken(token: string): CustomerTokenPayload | null {
  try {
    const payload = jwt.verify(token, SECRET) as Record<string, unknown>;
    if (payload.typ === "admin" || typeof payload.userId !== "string") return null;
    return payload as unknown as CustomerTokenPayload;
  } catch {
    return null;
  }
}

export const CUSTOMER_COOKIE_NAME = COOKIE_NAME;

export const CUSTOMER_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 60, // 60 days
};

/**
 * Server-side helper: the logged-in customer, or null. Besides the signature it
 * confirms the account still exists and that the session was issued after the
 * last password change/reset — so changing a password logs out every other
 * device, and a cookie can't outlive its account (which would otherwise make
 * inserts with a users(id) foreign key throw instead of answering "not logged in").
 */
export async function getCustomerSession(): Promise<CustomerTokenPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = verifyCustomerToken(token);
  if (!session) return null;
  const rows = await prisma.$queryRaw<{ changed: number | null }[]>`
    select floor(extract(epoch from password_changed_at))::int as changed
    from users where id = ${session.userId}::uuid and deleted_at is null limit 1
  `;
  if (!rows[0]) return null;
  if (rows[0].changed !== null && (session.iat ?? 0) < rows[0].changed) return null;
  return session;
}

