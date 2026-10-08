// app/api/cart/route.ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCustomerSession } from "@/lib/customer-auth";
import {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
  type CartIdentity,
} from "@/lib/cart";

const GUEST_COOKIE_NAME = "almadina_guest_cart";
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

/**
 * Resolves who this cart belongs to. Logged-in customers use their
 * account; everyone else gets (and keeps) an anonymous guest token in a
 * cookie, so the cart survives refreshes without requiring an account —
 * mergeGuestCartIntoUser() folds it into their account once they log in.
 */
async function resolveIdentity(req: NextRequest): Promise<{ identity: CartIdentity; newGuestToken?: string }> {
  // Verified, not just signature-checked: a stale cookie naming a since-deleted
  // user would otherwise crash the cart insert with a foreign key violation
  // instead of falling back to guest behavior.
  const session = await getCustomerSession();
  if (session?.userId) return { identity: { userId: session.userId } };

  const existingToken = req.cookies.get(GUEST_COOKIE_NAME)?.value;
  if (existingToken) return { identity: { guestToken: existingToken } };

  const newGuestToken = randomUUID();
  return { identity: { guestToken: newGuestToken }, newGuestToken };
}

function withGuestCookie(res: NextResponse, newGuestToken?: string) {
  if (newGuestToken) {
    res.cookies.set(GUEST_COOKIE_NAME, newGuestToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: GUEST_COOKIE_MAX_AGE,
    });
  }
  return res;
}

function errorResponse(err: unknown) {
  const message = err instanceof Error ? err.message : "Unknown error";
  const status =
    message === "OUT_OF_STOCK" ? 409 : message === "VARIANT_NOT_FOUND" || message === "ITEM_NOT_FOUND" ? 404 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  const { identity, newGuestToken } = await resolveIdentity(req);
  const res = NextResponse.json(await getCart(identity));
  return withGuestCookie(res, newGuestToken);
}

export async function POST(req: NextRequest) {
  const { identity, newGuestToken } = await resolveIdentity(req);

  const { variantId, quantity } = await req.json();
  if (!variantId || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    return NextResponse.json({ error: "variantId und eine positive Menge sind erforderlich." }, { status: 400 });
  }

  try {
    const cart = await addToCart(identity, variantId, quantity);
    return withGuestCookie(NextResponse.json(cart, { status: 201 }), newGuestToken);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: NextRequest) {
  const { identity, newGuestToken } = await resolveIdentity(req);

  const { itemId, quantity } = await req.json();
  if (!itemId || !Number.isInteger(quantity) || quantity > 99) {
    return NextResponse.json({ error: "itemId und Menge sind erforderlich." }, { status: 400 });
  }

  try {
    const cart = await updateCartItemQuantity(identity, itemId, quantity);
    return withGuestCookie(NextResponse.json(cart), newGuestToken);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: NextRequest) {
  const { identity, newGuestToken } = await resolveIdentity(req);

  const { itemId } = await req.json().catch(() => ({}));

  try {
    if (!itemId) {
      // No itemId = clear the whole cart (used right after a successful checkout).
      await clearCart(identity);
      return withGuestCookie(NextResponse.json(await getCart(identity)), newGuestToken);
    }
    const cart = await removeCartItem(identity, itemId);
    return withGuestCookie(NextResponse.json(cart), newGuestToken);
  } catch (err) {
    return errorResponse(err);
  }
}
