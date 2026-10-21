// A verified throwaway customer for tests that need a logged-in shopper.
// Sign-up now finishes with an emailed code, which tests can't read, so the
// account is created directly in the database and then logged in through the
// real /api/account/login route. Always call remove() in a finally block.
import { readFileSync, existsSync } from "fs";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import type { APIRequestContext } from "@playwright/test";

if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

export async function createTestCustomer(request: APIRequestContext, fullName = "Playwright Customer") {
  const prisma = new PrismaClient();
  const email = `pw-customer-${randomBytes(4).toString("hex")}@example.com`;
  const password = `Pw-${randomBytes(8).toString("hex")}`;
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `insert into users (email, password_hash, full_name, email_verified_at)
     values ($1, $2, $3, now()) returning id`,
    email,
    await bcrypt.hash(password, 10),
    fullName
  );
  const userId = rows[0].id;

  const login = await request.post("/api/account/login", { data: { email, password } });
  if (!login.ok()) throw new Error(`test customer login failed: ${login.status()}`);

  return {
    email,
    password,
    async remove() {
      await prisma.$executeRawUnsafe(`delete from users where id = $1::uuid`, userId);
      await prisma.$disconnect();
    },
  };
}

/** Removes an account a test created through the real sign-up route. */
export async function deleteUserByEmail(email: string) {
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(`delete from users where email = $1`, email);
  } finally {
    await prisma.$disconnect();
  }
}
