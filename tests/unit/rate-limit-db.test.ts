// Login rate limits against a real Postgres. Skipped unless TEST_DB=1 and DATABASE_URL points at a
// throwaway, migrated database.
import { describe, expect, it } from "vitest";
import { randomUUID } from "crypto";

const run = process.env.TEST_DB === "1";

describe.skipIf(!run)("rate limits (database)", async () => {
  // Vitest still runs this body while collecting a skipped suite: stop before touching the database.
  if (!run) {
    it.skip("needs TEST_DB=1 and a throwaway DATABASE_URL", () => {});
    return;
  }
  const { rateLimit, refundRateLimit, resetRateLimit } = await import("@/lib/rate-limit");

  it("blocks once the limit is used up, also for parallel attempts", async () => {
    const key = `test:${randomUUID()}`;
    const results = await Promise.all(Array.from({ length: 8 }, () => rateLimit(key, 5, 60_000)));
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
    await resetRateLimit(key);
  });

  it("a refunded attempt (successful login) doesn't use up the window", async () => {
    const key = `test:${randomUUID()}`;
    for (let i = 0; i < 30; i++) {
      expect((await rateLimit(key, 20, 60_000)).allowed).toBe(true);
      await refundRateLimit(key);
    }
    await resetRateLimit(key);
  });

  it("refund never goes below zero, so it can't bank extra attempts", async () => {
    const key = `test:${randomUUID()}`;
    await rateLimit(key, 2, 60_000);
    for (let i = 0; i < 5; i++) await refundRateLimit(key);
    const r = await Promise.all([rateLimit(key, 2, 60_000), rateLimit(key, 2, 60_000), rateLimit(key, 2, 60_000)]);
    expect(r.filter((x) => x.allowed)).toHaveLength(2);
    await resetRateLimit(key);
  });
});
