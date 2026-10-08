import { randomBytes, createHash } from "crypto";
import { prisma } from "./prisma";

const EXPIRY_MINUTES = 60;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Creates a single-use reset token for the user (invalidating older ones) and returns the plaintext. */
export async function createPasswordReset(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60_000);
  await prisma.$transaction([
    prisma.$executeRaw`delete from password_resets where user_id = ${userId}::uuid`,
    prisma.$executeRaw`
      insert into password_resets (user_id, token_hash, expires_at)
      values (${userId}::uuid, ${hashToken(token)}, ${expiresAt})
    `,
  ]);
  return token;
}

/** Looks up a still-valid, unused token. Returns the user id, or null. */
export async function findValidReset(token: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ user_id: string }[]>`
    select user_id from password_resets
    where token_hash = ${hashToken(token)} and used_at is null and expires_at > now()
    limit 1
  `;
  return rows[0]?.user_id ?? null;
}

/** Atomically consumes the token and sets the new password hash. Returns the user id, or null if the token was invalid/used. */
export async function consumeReset(token: string, passwordHash: string): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ user_id: string }[]>`
      update password_resets set used_at = now()
      where token_hash = ${hashToken(token)} and used_at is null and expires_at > now()
      returning user_id
    `;
    const userId = rows[0]?.user_id;
    if (!userId) return null;
    // Proving control of the inbox also verifies the email address; password_changed_at
    // logs out every existing session (e.g. whoever knew the old password).
    await tx.$executeRaw`
      update users set password_hash = ${passwordHash}, password_changed_at = now(),
        email_verified_at = coalesce(email_verified_at, now())
      where id = ${userId}::uuid
    `;
    return userId;
  });
}
