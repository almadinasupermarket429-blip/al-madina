"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mapServerCart, type CartItem, type Product, type ProductSize, type ServerCartItem, type Translate } from "./types";

type CartResponse = { items: ServerCartItem[]; error?: string; code?: string };

/** The server refused the change (e.g. out of stock); `code` says why. */
class CartRejected extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/** The basket, kept in sync with the server-side cart (guest cookie or account). */
export function useCart(t: Translate, notify: (message: string) => void) {
  const [items, setItems] = useState<CartItem[]>([]);
  // Responses can arrive out of order (e.g. the initial load racing a quick
  // "add" click) — only the newest request may update the basket.
  const seq = useRef(0);

  const send = useCallback(
    async (method: "GET" | "POST" | "PATCH" | "DELETE", body?: object): Promise<CartResponse | null> => {
      const mine = ++seq.current;
      const res = await fetch("/api/cart", {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data: CartResponse = await res.json();
      if (!res.ok) throw new CartRejected(data.code || "");
      if (seq.current === mine && Array.isArray(data.items)) setItems(mapServerCart(data.items));
      return data;
    },
    []
  );

  useEffect(() => {
    send("GET").catch(() => {});
  }, [send]);

  const connectionError = useCallback(
    (e: unknown, rejectedFallback: string) => {
      if (!(e instanceof CartRejected)) {
        notify(t("Verbindungsfehler. Bitte versuchen Sie es erneut.", "Connection error. Please try again."));
        return;
      }
      const messages: Record<string, string> = {
        OUT_OF_STOCK: t("So viele sind leider nicht mehr auf Lager.", "Sorry, there aren't that many left in stock."),
        ITEM_LIMIT: t("Höchstens 50 Stück pro Artikel.", "At most 50 of each item."),
        CART_FULL: t("Ihr Warenkorb ist voll.", "Your basket is full."),
        VARIANT_NOT_FOUND: t("Dieser Artikel ist nicht mehr erhältlich.", "This item is no longer available."),
        ITEM_NOT_FOUND: t("Dieser Artikel ist nicht mehr im Warenkorb.", "This item is no longer in your basket."),
      };
      notify(messages[e.code] ?? rejectedFallback);
    },
    [notify, t]
  );

  const add = useCallback(
    (product: Product, size: ProductSize, qty = 1, silent = false) =>
      send("POST", { variantId: size.id, quantity: qty })
        .then(() => {
          if (!silent) notify(t(`${product.name} (${size.label}) wurde hinzugefügt`, `${product.name} (${size.label}) added to your basket`));
        })
        .catch((e) => connectionError(e, t("Konnte nicht hinzugefügt werden", "Couldn't add that to your basket"))),
    [send, notify, t, connectionError]
  );

  const changeQty = useCallback(
    (key: string, delta: number) => {
      const current = items.find((i) => i.key === key);
      if (!current) return;
      send("PATCH", { itemId: key, quantity: current.qty + delta }).catch((e) =>
        connectionError(e, t("Konnte nicht aktualisiert werden", "Couldn't update that item"))
      );
    },
    [items, send, t, connectionError]
  );

  /** After a successful order: empty the basket locally and on the server. */
  const clear = useCallback(() => {
    seq.current++;
    setItems([]);
    fetch("/api/cart", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
  }, []);

  const count = items.reduce((sum, i) => sum + i.qty, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  return { items, count, subtotal, add, changeQty, clear };
}
