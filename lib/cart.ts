// lib/cart.ts
//
// Cart identity is either a logged-in user OR an anonymous guest token
// (a long random string in a cookie, set by app/api/cart/route.ts on first
// use). This lets someone add to cart before logging in — same as Amazon —
// and mergeGuestCartIntoUser() below folds that guest cart into their
// account cart the moment they log in or register.

import { prisma } from "./prisma";

export type CartIdentity = { userId: string } | { guestToken: string };

export type CartItem = {
  id: string;
  variant_id: string;
  quantity: number;
  sku: string;
  size_label: string;
  price: number;
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

async function getOrCreateCartId(identity: CartIdentity): Promise<string> {
  if ("userId" in identity) {
    const existing = await prisma.$queryRaw<{ id: string }[]>`
      select id from carts where user_id = ${identity.userId}::uuid limit 1
    `;
    if (existing[0]) return existing[0].id;

    const created = await prisma.$queryRaw<{ id: string }[]>`
      insert into carts (user_id) values (${identity.userId}::uuid) returning id
    `;
    return created[0].id;
  }

  const existing = await prisma.$queryRaw<{ id: string }[]>`
    select id from carts where guest_token = ${identity.guestToken} limit 1
  `;
  if (existing[0]) return existing[0].id;

  const created = await prisma.$queryRaw<{ id: string }[]>`
    insert into carts (guest_token) values (${identity.guestToken}) returning id
  `;
  return created[0].id;
}

// Split from getCart() so mutating operations that already resolved a
// cartId (add/update/remove, all below) can re-fetch the cart without a
// redundant getOrCreateCartId() round trip — each Neon round trip from
// local dev adds real, user-visible latency, and every mutation used to
// pay for the identity lookup twice.
async function getCartByCartId(cartId: string): Promise<Cart> {
  const rows = await prisma.$queryRaw<(Omit<CartItem, "price"> & { price: string })[]>`
    select
      ci.id, ci.variant_id, ci.quantity,
      pv.sku, pv.size_label, pv.price, pv.stock_quantity,
      p.id as product_id, p.name as product_name, p.slug as product_slug, p.image_url
    from cart_items ci
    join product_variants pv on pv.id = ci.variant_id
    join products p on p.id = pv.product_id
    where ci.cart_id = ${cartId}::uuid
    order by ci.created_at asc
  `;

  const items = rows.map((r) => ({ ...r, price: Number(r.price) }));
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return { cartId, items, subtotal };
}

export async function getCart(identity: CartIdentity): Promise<Cart> {
  const cartId = await getOrCreateCartId(identity);
  return getCartByCartId(cartId);
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

  const cartId = await getOrCreateCartId(identity);

  const existingItem = await prisma.$queryRaw<{ id: string; quantity: number }[]>`
    select id, quantity from cart_items where cart_id = ${cartId}::uuid and variant_id = ${variantId}::uuid
  `;

  const nextQuantity = (existingItem[0]?.quantity ?? 0) + quantity;
  if (nextQuantity > variant[0].stock_quantity) throw new Error("OUT_OF_STOCK");

  if (existingItem[0]) {
    await prisma.$executeRaw`update cart_items set quantity = ${nextQuantity} where id = ${existingItem[0].id}::uuid`;
  } else {
    await prisma.$executeRaw`
      insert into cart_items (cart_id, variant_id, quantity)
      values (${cartId}::uuid, ${variantId}::uuid, ${quantity})
    `;
  }

  return getCartByCartId(cartId);
}

export async function updateCartItemQuantity(
  identity: CartIdentity,
  itemId: string,
  quantity: number
): Promise<Cart> {
  const cartId = await getOrCreateCartId(identity);

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
  if (quantity > variant[0].stock_quantity) throw new Error("OUT_OF_STOCK");

  await prisma.$executeRaw`
    update cart_items set quantity = ${quantity} where id = ${itemId}::uuid and cart_id = ${cartId}::uuid
  `;
  return getCartByCartId(cartId);
}

export async function removeCartItem(identity: CartIdentity, itemId: string): Promise<Cart> {
  const cartId = await getOrCreateCartId(identity);
  await prisma.$executeRaw`delete from cart_items where id = ${itemId}::uuid and cart_id = ${cartId}::uuid`;
  return getCartByCartId(cartId);
}

export async function clearCart(identity: CartIdentity): Promise<void> {
  const cartId = await getOrCreateCartId(identity);
  await prisma.$executeRaw`delete from cart_items where cart_id = ${cartId}::uuid`;
}

/**
 * Called on login/register: folds a guest cart's items into the user's
 * cart (merging quantities where both have the same variant), then
 * deletes the now-empty guest cart. Safe to call even if the guest never
 * had a cart at all.
 */
export async function mergeGuestCartIntoUser(guestToken: string, userId: string): Promise<void> {
  const guestCart = await prisma.$queryRaw<{ id: string }[]>`
    select id from carts where guest_token = ${guestToken} limit 1
  `;
  if (!guestCart[0]) return;

  const guestCartId = guestCart[0].id;
  const userCartId = await getOrCreateCartId({ userId });

  const guestItems = await prisma.$queryRaw<{ variant_id: string; quantity: number }[]>`
    select variant_id, quantity from cart_items where cart_id = ${guestCartId}::uuid
  `;

  for (const item of guestItems) {
    const existing = await prisma.$queryRaw<{ id: string; quantity: number }[]>`
      select id, quantity from cart_items where cart_id = ${userCartId}::uuid and variant_id = ${item.variant_id}::uuid
    `;
    if (existing[0]) {
      await prisma.$executeRaw`
        update cart_items set quantity = ${existing[0].quantity + item.quantity} where id = ${existing[0].id}::uuid
      `;
    } else {
      await prisma.$executeRaw`
        insert into cart_items (cart_id, variant_id, quantity)
        values (${userCartId}::uuid, ${item.variant_id}::uuid, ${item.quantity})
      `;
    }
  }

  await prisma.$executeRaw`delete from carts where id = ${guestCartId}::uuid`;
}
