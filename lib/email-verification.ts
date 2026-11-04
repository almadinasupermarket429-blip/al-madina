import { randomInt, createHash, timingSafeEqual } from "crypto";
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
  // Count the attempt first, in the same statement that checks the limit: guesses sent in
  // parallel can't all slip in under MAX_ATTEMPTS before any of them is counted.
  const counted = await prisma.$queryRaw<{ id: string; code_hash: string; expires_at: Date }[]>`
    update email_verifications set attempts = attempts + 1
    where id = (
      select id from email_verifications where user_id = ${userId}::uuid order by created_at desc limit 1
    ) and attempts < ${MAX_ATTEMPTS}
    returning id, code_hash, expires_at
  `;
  const pending = counted[0];
  if (!pending) {
    const any = await prisma.$queryRaw<{ n: bigint }[]>`select count(*) as n from email_verifications where user_id = ${userId}::uuid`;
    return Number(any[0]?.n ?? 0) > 0 ? "TOO_MANY_ATTEMPTS" : "NO_PENDING_CODE";
  }
  if (new Date(pending.expires_at).getTime() < Date.now()) return "EXPIRED";

  const given = Buffer.from(hashCode(submittedCode.trim()), "hex");
  const stored = Buffer.from(pending.code_hash, "hex");
  if (given.length !== stored.length || !timingSafeEqual(given, stored)) return "INVALID";

  // Only the request that deletes the code verifies the account (a second, parallel correct guess gets INVALID).
  const used = await prisma.$executeRaw`delete from email_verifications where id = ${pending.id}::uuid`;
  if (used === 0) return "INVALID";
  await prisma.$executeRaw`update users set email_verified_at = coalesce(email_verified_at, now()) where id = ${userId}::uuid`;
  await prisma.$executeRaw`delete from email_verifications where user_id = ${userId}::uuid`;
  return "OK";
}

export async function isEmailVerified(userId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ verified: boolean }[]>`
    select (email_verified_at is not null) as verified from users where id = ${userId}::uuid
  `;
  return rows[0]?.verified ?? false;
}
