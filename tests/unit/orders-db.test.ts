// Order status and email-code rules against a real Postgres. Skipped unless TEST_DB=1 and
// DATABASE_URL points at a throwaway, migrated database (see tests/unit/cart-db.test.ts).
import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";

const run = process.env.TEST_DB === "1";

describe.skipIf(!run)("orders and email codes (database)", async () => {
  // Vitest still runs this body while collecting a skipped suite: stop before touching the database.
  if (!run) {
    it.skip("needs TEST_DB=1 and a throwaway DATABASE_URL", () => {});
    return;
  }
  const { prisma } = await import("@/lib/prisma");
  const { cancelOrder, getOrderById, setOrderStatus } = await import("@/lib/orders");
  const { createEmailVerification, verifyEmailCode } = await import("@/lib/email-verification");

  const user = await prisma.$queryRaw<{ id: string }[]>`
    insert into users (email, password_hash, full_name)
    values (${`orders-test-${randomUUID()}@example.com`}, 'x', 'Order Test') returning id
  `;
  const userId = user[0].id;

  async function newOrder(): Promise<string> {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      insert into orders (order_number, customer_name, customer_email, customer_phone, fulfillment,
                          subtotal, discount, delivery_fee, total, delivery_token, user_id, status, substitution)
      values (${`AM-TEST-${randomUUID().slice(0, 8)}`}, 'Test', 'test@example.com', '01520 0000000', 'PICKUP',
              10, 0, 0, 10, ${randomUUID()}, ${userId}::uuid, 'PLACED', 'CALL')
      returning id
    `;
    return rows[0].id;
  }

  afterAll(async () => {
    await prisma.$executeRaw`delete from orders where user_id = ${userId}::uuid`;
    await prisma.$executeRaw`delete from users where id = ${userId}::uuid`;
    await prisma.$disconnect();
  });

  it("refuses to move an order backwards", async () => {
    const id = await newOrder();
    expect(await setOrderStatus(id, "PACKED")).toBe(true);
    expect(await setOrderStatus(id, "PLACED")).toBe(false);
    expect((await getOrderById(id))?.status).toBe("PACKED");
  });

  it("a cancel and a status change at the same moment: only one wins", async () => {
    const id = await newOrder();
    const [cancelled, moved] = await Promise.all([cancelOrder(id, "test"), setOrderStatus(id, "OUT_FOR_DELIVERY")]);
    const final = (await getOrderById(id))?.status;
    expect(cancelled !== moved).toBe(true);
    expect(final).toBe(cancelled ? "CANCELLED" : "OUT_FOR_DELIVERY");
  });

  it("two taps on 'delivered' write the history once", async () => {
    const id = await newOrder();
    const results = await Promise.all([setOrderStatus(id, "DELIVERED"), setOrderStatus(id, "DELIVERED")]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const history = await prisma.$queryRaw<{ n: bigint }[]>`
      select count(*) as n from order_status_history where order_id = ${id}::uuid and status = 'DELIVERED'
    `;
    expect(Number(history[0].n)).toBe(1);
  });

  it("parallel wrong guesses can't get past the limit of 5 tries", async () => {
    const code = await createEmailVerification(userId);
    const wrong = code === "000000" ? "111111" : "000000";
    const results = await Promise.all(Array.from({ length: 20 }, () => verifyEmailCode(userId, wrong)));
    expect(results.filter((r) => r === "INVALID")).toHaveLength(5);
    expect(results.filter((r) => r === "TOO_MANY_ATTEMPTS")).toHaveLength(15);
    // Even the right code no longer works after 5 tries.
    expect(await verifyEmailCode(userId, code)).toBe("TOO_MANY_ATTEMPTS");
  });

  it("the right code verifies the account once", async () => {
    const code = await createEmailVerification(userId);
    const results = await Promise.all([verifyEmailCode(userId, code), verifyEmailCode(userId, code)]);
    expect(results.filter((r) => r === "OK")).toHaveLength(1);
  });
});
