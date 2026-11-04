// lib/cart.ts
//
// Cart identity is either a logged-in user OR an anonymous guest token
// (a long random string in a cookie, set by app/api/cart/route.ts on first
// use). This lets someone add to cart before logging in — same as Amazon —
// and mergeGuestCartIntoUser() below folds that guest cart into their
// account cart the moment they log in or register.

import { prisma } from "./prisma";

export type CartIdentity = { userId: string } | { guestToken: string };

type CartItem = {
  id: string;
  variant_id: string;
  quantity: number;
  sku: string;
  size_label: string;
  price: number;
  deposit: number;
  stock_quantity: number;
  product_id: string;
  product_name: string;
  product_slug: string;
  image_url: string | null;
};

export type Cart = {
  cartId: string;
  items: CartItem[];
  subtotal: number;
};

/** Most of one size per basket (orders merge and cap lines the same way). */
export const MAX_QTY_PER_ITEM = 50;
/** Most different items per basket (an order takes at most 100 lines). */
const MAX_CART_LINES = 100;

/** Error codes the cart API answers with; the shop translates them (app/_store/useCart.ts). */
export type CartErrorCode = "VARIANT_NOT_FOUND" | "ITEM_NOT_FOUND" | "OUT_OF_STOCK" | "ITEM_LIMIT" | "CART_FULL";

async function getOrCreateCartId(identity: CartIdentity): Promise<string> {
  // Upsert: two first "add" clicks at once would otherwise both insert and one would fail on the unique key.
  const rows =
    "userId" in identity
      ? await prisma.$queryRaw<{ id: string }[]>`
          insert into carts (user_id) values (${identity.userId}::uuid)
          on conflict (user_id) do update set user_id = excluded.user_id
          returning id
        `
      : await prisma.$queryRaw<{ id: string }[]>`
          insert into carts (guest_token) values (${identity.guestToken})
          on conflict (guest_token) do update set guest_token = excluded.guest_token
          returning id
        `;
  return rows[0].id;
}

// Split from getCart() so mutating operations that already resolved a
// cartId (add/update/remove, all below) can re-fetch the cart without a
// redundant getOrCreateCartId() round trip — each Neon round trip from
// local dev adds real, user-visible latency, and every mutation used to
// pay for the identity lookup twice.
async function getCartByCartId(cartId: string): Promise<Cart> {
  const rows = await prisma.$queryRaw<(Omit<CartItem, "price" | "deposit"> & { price: string; deposit: string })[]>`
    select
      ci.id, ci.variant_id, ci.quantity,
      pv.sku, pv.size_label, pv.price, pv.deposit, pv.stock_quantity,
      p.id as product_id, p.name as product_name, p.slug as product_slug, p.image_url
    from cart_items ci
    join product_variants pv on pv.id = ci.variant_id
    join products p on p.id = pv.product_id
    where ci.cart_id = ${cartId}::uuid
    order by ci.created_at asc
  `;

  const items = rows.map((r) => ({ ...r, price: Number(r.price), deposit: Number(r.deposit ?? 0) }));
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return { cartId, items, subtotal };
}

/** The visitor's cart id, or null. Never creates one. */
async function findCartId(identity: CartIdentity): Promise<string | null> {
  const rows =
    "userId" in identity
      ? await prisma.$queryRaw<{ id: string }[]>`select id from carts where user_id = ${identity.userId}::uuid limit 1`
      : await prisma.$queryRaw<{ id: string }[]>`select id from carts where guest_token = ${identity.guestToken} limit 1`;
  return rows[0]?.id ?? null;
}

const EMPTY_CART: Cart = { cartId: "", items: [], subtotal: 0 };

/**
 * Only adding creates a cart row. Reading, changing or clearing a cart that doesn't exist yet
 * answers with an empty cart, so visitors and bots that only look leave nothing in the database.
 */
export async function getCart(identity: CartIdentity): Promise<Cart> {
  const cartId = await findCartId(identity);
  return cartId ? getCartByCartId(cartId) : EMPTY_CART;
}

export async function addToCart(
  identity: CartIdentity,
  variantId: string,
  quantity: number
): Promise<Cart> {
  const variant = await prisma.$queryRaw<{ stock_quantity: number }[]>`
    select stock_quantity from product_variants where id = ${variantId}::uuid and is_active = true
  `;
  if (!variant[0]) throw new Error("VARIANT_NOT_FOUND");
  const limit = Math.min(variant[0].stock_quantity, MAX_QTY_PER_ITEM);
  if (quantity > limit) throw new Error(variant[0].stock_quantity < MAX_QTY_PER_ITEM ? "OUT_OF_STOCK" : "ITEM_LIMIT");

  const cartId = await getOrCreateCartId(identity);

  const lines = await prisma.$queryRaw<{ n: bigint; has: boolean }[]>`
    select count(*) as n, bool_or(variant_id = ${variantId}::uuid) as has
    from cart_items where cart_id = ${cartId}::uuid
  `;
  if (!lines[0]?.has && Number(lines[0]?.n ?? 0) >= MAX_CART_LINES) throw new Error("CART_FULL");

  // One statement, so two quick clicks can't both read the old quantity and lose one.
  const saved = await prisma.$queryRaw<{ quantity: number }[]>`
    insert into cart_items (cart_id, variant_id, quantity)
    values (${cartId}::uuid, ${variantId}::uuid, ${quantity})
    on conflict (cart_id, variant_id) do update
      set quantity = cart_items.quantity + excluded.quantity
      where cart_items.quantity + excluded.quantity <= ${limit}
    returning quantity
  `;
  if (!saved[0]) throw new Error(variant[0].stock_quantity < MAX_QTY_PER_ITEM ? "OUT_OF_STOCK" : "ITEM_LIMIT");

  return getCartByCartId(cartId);
}

export async function updateCartItemQuantity(
  identity: CartIdentity,
  itemId: string,
  quantity: number
): Promise<Cart> {
  const cartId = await findCartId(identity);
  if (!cartId) throw new Error("ITEM_NOT_FOUND");

  if (quantity <= 0) {
    await prisma.$executeRaw`delete from cart_items where id = ${itemId}::uuid and cart_id = ${cartId}::uuid`;
    return getCartByCartId(cartId);
  }

  const variant = await prisma.$queryRaw<{ stock_quantity: number }[]>`
    select pv.stock_quantity
    from cart_items ci join product_variants pv on pv.id = ci.variant_id
    where ci.id = ${itemId}::uuid and ci.cart_id = ${cartId}::uuid
  `;
  if (!variant[0]) throw new Error("ITEM_NOT_FOUND");
  if (quantity > MAX_QTY_PER_ITEM) throw new Error("ITEM_LIMIT");
  if (quantity > variant[0].stock_quantity) throw new Error("OUT_OF_STOCK");

  await prisma.$executeRaw`
    update cart_items set quantity = ${quantity} where id = ${itemId}::uuid and cart_id = ${cartId}::uuid
  `;
  return getCartByCartId(cartId);
}

export async function removeCartItem(identity: CartIdentity, itemId: string): Promise<Cart> {
  const cartId = await findCartId(identity);
  if (!cartId) return EMPTY_CART;
  await prisma.$executeRaw`delete from cart_items where id = ${itemId}::uuid and cart_id = ${cartId}::uuid`;
  return getCartByCartId(cartId);
}

export async function clearCart(identity: CartIdentity): Promise<void> {
  const cartId = await findCartId(identity);
  if (!cartId) return;
  await prisma.$executeRaw`delete from cart_items where cart_id = ${cartId}::uuid`;
}

/**
 * Called on login/register: folds a guest cart's items into the user's cart (adding quantities
 * where both have the same size, capped at MAX_QTY_PER_ITEM and the stock), then deletes the guest
 * cart. Lines beyond MAX_CART_LINES are dropped. Safe to call when the guest never had a cart.
 */
export async function mergeGuestCartIntoUser(guestToken: string, userId: string): Promise<void> {
  const guestCart = await prisma.$queryRaw<{ id: string }[]>`
    select id from carts where guest_token = ${guestToken} limit 1
  `;
  if (!guestCart[0]) return;

  const guestCartId = guestCart[0].id;
  const userCartId = await getOrCreateCartId({ userId });

  await prisma.$transaction([
    prisma.$executeRaw`
      with room as (
        select greatest(${MAX_CART_LINES} - count(*), 0) as free from cart_items where cart_id = ${userCartId}::uuid
      ),
      incoming as (
        select g.variant_id, least(g.quantity, ${MAX_QTY_PER_ITEM}, pv.stock_quantity) as quantity,
               exists (select 1 from cart_items u where u.cart_id = ${userCartId}::uuid and u.variant_id = g.variant_id) as existing,
               g.created_at
        from cart_items g
        join product_variants pv on pv.id = g.variant_id and pv.is_active = true
        where g.cart_id = ${guestCartId}::uuid and pv.stock_quantity > 0
      ),
      ranked as (
        select *, row_number() over (partition by existing order by created_at) as rn from incoming
      )
      insert into cart_items (cart_id, variant_id, quantity)
      select ${userCartId}::uuid, variant_id, quantity
      from ranked, room
      where existing or rn <= room.free
      on conflict (cart_id, variant_id) do update
        set quantity = least(cart_items.quantity + excluded.quantity, ${MAX_QTY_PER_ITEM},
                             (select stock_quantity from product_variants where id = excluded.variant_id))
    `,
    prisma.$executeRaw`delete from carts where id = ${guestCartId}::uuid`,
  ]);
}
