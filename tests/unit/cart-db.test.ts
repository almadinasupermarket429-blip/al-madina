// Cart rules against a real Postgres. Skipped unless TEST_DB=1 and DATABASE_URL points at a
// throwaway database that has been migrated and seeded (npm run db:migrate && npm run db:seed).
import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";

const run = process.env.TEST_DB === "1";

describe.skipIf(!run)("cart (database)", async () => {
  // Vitest still runs this body while collecting a skipped suite: stop before touching the database.
  if (!run) {
    it.skip("needs TEST_DB=1 and a throwaway DATABASE_URL", () => {});
    return;
  }
  const { prisma } = await import("@/lib/prisma");
  const cart = await import("@/lib/cart");

  const variants = await prisma.$queryRaw<{ id: string }[]>`
    select id from product_variants where is_active = true order by id limit 2
  `;
  const [a, b] = variants.map((v) => v.id);
  await prisma.$executeRaw`update product_variants set stock_quantity = 500 where id in (${a}::uuid, ${b}::uuid)`;

  const user = await prisma.$queryRaw<{ id: string }[]>`
    insert into users (email, password_hash, full_name)
    values (${`cart-test-${randomUUID()}@example.com`}, 'x', 'Cart Test') returning id
  `;
  const userId = user[0].id;

  afterAll(async () => {
    await prisma.$executeRaw`delete from users where id = ${userId}::uuid`;
    await prisma.$disconnect();
  });

  it("adds the same size twice at once without losing a click", async () => {
    const guest = { guestToken: randomUUID() };
    await Promise.all([cart.addToCart(guest, a, 1), cart.addToCart(guest, a, 1), cart.addToCart(guest, a, 1)]);
    const c = await cart.getCart(guest);
    expect(c.items).toHaveLength(1);
    expect(c.items[0].quantity).toBe(3);
  });

  it("caps one size at 50", async () => {
    const guest = { guestToken: randomUUID() };
    await cart.addToCart(guest, a, 49);
    await expect(cart.addToCart(guest, a, 2)).rejects.toThrow("ITEM_LIMIT");
    expect((await cart.getCart(guest)).items[0].quantity).toBe(49);
  });

  it("refuses more than the stock", async () => {
    const guest = { guestToken: randomUUID() };
    await prisma.$executeRaw`update product_variants set stock_quantity = 2 where id = ${b}::uuid`;
    await expect(cart.addToCart(guest, b, 3)).rejects.toThrow("OUT_OF_STOCK");
    await prisma.$executeRaw`update product_variants set stock_quantity = 500 where id = ${b}::uuid`;
  });

  it("merges a guest basket into the account, capped at 50 per size", async () => {
    const guest = { guestToken: randomUUID() };
    await cart.addToCart({ userId }, a, 30);
    await cart.addToCart(guest, a, 30);
    await cart.addToCart(guest, b, 2);
    await cart.mergeGuestCartIntoUser(guest.guestToken, userId);
    const merged = await cart.getCart({ userId });
    const qty = Object.fromEntries(merged.items.map((i) => [i.variant_id, i.quantity]));
    expect(qty[a]).toBe(50);
    expect(qty[b]).toBe(2);
    expect((await cart.getCart(guest)).items).toHaveLength(0);
  });
});
