import { randomInt, createHash } from "crypto";
import { prisma } from "./prisma";

const CODE_LENGTH = 6;
const EXPIRY_MINUTES = 15;
const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** Generates a fresh 6-digit code, stores its hash, and returns the plaintext to email. */
export async function createEmailVerification(userId: string): Promise<string> {
  const code = randomInt(0, 1_000_000).toString().padStart(CODE_LENGTH, "0");
  const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60_000);

  // One active code per user — clear any previous unused ones first.
  await prisma.$executeRaw`delete from email_verifications where user_id = ${userId}::uuid`;
  await prisma.$executeRaw`
    insert into email_verifications (user_id, code_hash, expires_at)
    values (${userId}::uuid, ${hashCode(code)}, ${expiresAt})
  `;

  if (process.env.NODE_ENV !== "production") {
    console.log(`[dev] email verification code for user ${userId}: ${code}`);
  }

  return code;
}

type VerifyResult = "OK" | "INVALID" | "EXPIRED" | "TOO_MANY_ATTEMPTS" | "NO_PENDING_CODE";

/** Checks a submitted code against the stored hash, marking the account verified on success. */
export async function verifyEmailCode(userId: string, submittedCode: string): Promise<VerifyResult> {
  const rows = await prisma.$queryRaw<{ id: string; code_hash: string; expires_at: Date; attempts: number }[]>`
    select id, code_hash, expires_at, attempts from email_verifications
    where user_id = ${userId}::uuid
    order by created_at desc
    limit 1
  `;
  const pending = rows[0];
  if (!pending) return "NO_PENDING_CODE";

  if (pending.attempts >= MAX_ATTEMPTS) return "TOO_MANY_ATTEMPTS";
  if (new Date(pending.expires_at).getTime() < Date.now()) return "EXPIRED";

  if (hashCode(submittedCode.trim()) !== pending.code_hash) {
    await prisma.$executeRaw`update email_verifications set attempts = attempts + 1 where id = ${pending.id}::uuid`;
    return "INVALID";
  }

  await prisma.$transaction([
    prisma.$executeRaw`update users set email_verified_at = now() where id = ${userId}::uuid`,
    prisma.$executeRaw`delete from email_verifications where user_id = ${userId}::uuid`,
  ]);
  return "OK";
}

export async function isEmailVerified(userId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ verified: boolean }[]>`
    select (email_verified_at is not null) as verified from users where id = ${userId}::uuid
  `;
  return rows[0]?.verified ?? false;
}
