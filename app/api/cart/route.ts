// app/api/cart/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isUuid } from "@/lib/orders";
import { randomUUID } from "crypto";
import { getCustomerSession } from "@/lib/customer-auth";
import {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
  MAX_QTY_PER_ITEM,
  type CartErrorCode,
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

const CART_ERRORS: Record<CartErrorCode, { status: number; error: string }> = {
  VARIANT_NOT_FOUND: { status: 404, error: "Dieser Artikel ist nicht mehr erhältlich." },
  ITEM_NOT_FOUND: { status: 404, error: "Dieser Artikel ist nicht mehr im Warenkorb." },
  OUT_OF_STOCK: { status: 409, error: "So viele sind leider nicht mehr auf Lager." },
  ITEM_LIMIT: { status: 409, error: `Höchstens ${MAX_QTY_PER_ITEM} Stück pro Artikel.` },
  CART_FULL: { status: 409, error: "Ihr Warenkorb ist voll." },
};

/** `code` lets the shop show the message in the visitor's language; `error` is the German text. */
function errorResponse(err: unknown) {
  const code = (err instanceof Error ? err.message : "") as CartErrorCode;
  const known = CART_ERRORS[code];
  if (!known) {
    console.error("[cart]", err);
    return NextResponse.json({ error: "Warenkorb konnte nicht geändert werden.", code: "UNKNOWN" }, { status: 500 });
  }
  return NextResponse.json({ error: known.error, code }, { status: known.status });
}

export async function GET(req: NextRequest) {
  // A first-time visitor gets an empty cart and no cookie; the cookie comes with the first item.
  const { identity } = await resolveIdentity(req);
  return NextResponse.json(await getCart(identity));
}

export async function POST(req: NextRequest) {
  const { identity, newGuestToken } = await resolveIdentity(req);

  const { variantId, quantity } = await req.json().catch(() => ({}));
  if (!variantId || typeof variantId !== "string" || !isUuid(variantId) || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY_PER_ITEM) {
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

  const { itemId, quantity } = await req.json().catch(() => ({}));
  if (!itemId || typeof itemId !== "string" || !isUuid(itemId) || !Number.isInteger(quantity) || quantity > MAX_QTY_PER_ITEM) {
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
    if (itemId && (typeof itemId !== "string" || !isUuid(itemId))) {
      return NextResponse.json({ error: "Artikel nicht gefunden." }, { status: 404 });
    }
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
