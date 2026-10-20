// lib/auth.ts
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { getCustomerSession } from "./customer-auth";
import { signToken, verifyToken } from "./tokens";

const COOKIE_NAME = "almadina_admin_session";

type AdminRole = "OWNER" | "STAFF";

type AdminTokenPayload = {
  username: string; // email for a real admin account, or the .env ADMIN_USERNAME for the fallback login
  role: AdminRole;
  adminId: string | null; // the users.id for a real admin account, null for the .env fallback
};

export function signAdminToken(payload: AdminTokenPayload): Promise<string> {
  // typ marks this as an admin token: customer tokens are signed with the same
  // secret and must never be accepted in the admin cookie.
  return signToken({ ...payload, typ: "admin" }, "30d");
}

async function verifyAdminToken(token: string): Promise<(AdminTokenPayload & { iat?: number }) | null> {
  const payload = await verifyToken(token);
  if (!payload || payload.typ !== "admin" || (payload.role !== "OWNER" && payload.role !== "STAFF")) return null;
  return payload as unknown as AdminTokenPayload & { iat?: number };
}

/** OWNER-only areas (analytics, product editing, review moderation, team management). */
export function isOwner(session: AdminTokenPayload | null): boolean {
  return session?.role === "OWNER";
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;

/** Current role of a real admin account, or null if it's no longer an admin (or its password changed after `iat`). */
async function lookupAdmin(userId: string, iat?: number): Promise<{ role: AdminRole; email: string } | null> {
  const rows = await prisma.$queryRaw<{ role: AdminRole; email: string; changed: number | null }[]>`
    select a.role, u.email, floor(extract(epoch from u.password_changed_at))::int as changed
    from admin_users a
    join users u on u.id = a.user_id
    where a.user_id = ${userId}::uuid and u.deleted_at is null
  `;
  const row = rows[0];
  if (!row) return null;
  if (iat !== undefined && row.changed !== null && iat < row.changed) return null;
  return row;
}

/**
 * Server-side helper: is the current visitor an admin? Checks two paths:
 *  1. The admin cookie from /admin/login — either the .env fallback super-admin,
 *     or a real admin account (whose role is re-read from the database, so
 *     removing someone on the Team page takes effect immediately).
 *  2. The normal customer login — if this account has an admin_users row,
 *     they're an admin too, no separate credentials needed.
 */
export async function getAdminSession(): Promise<AdminTokenPayload | null> {
  const store = await cookies();
  const adminToken = store.get(COOKIE_NAME)?.value;
  const payload = adminToken ? await verifyAdminToken(adminToken) : null;
  if (payload) {
    if (payload.adminId === null) {
      // .env fallback: valid only while that username is still the configured one.
      if (process.env.ADMIN_USERNAME && payload.username === process.env.ADMIN_USERNAME) {
        return { username: payload.username, role: "OWNER", adminId: null };
      }
    } else {
      const admin = await lookupAdmin(payload.adminId, payload.iat);
      if (admin) return { username: admin.email, role: admin.role, adminId: payload.adminId };
    }
  }

  const customerSession = await getCustomerSession();
  if (!customerSession) return null;
  const admin = await lookupAdmin(customerSession.userId);
  return admin ? { username: admin.email, role: admin.role, adminId: customerSession.userId } : null;
}
