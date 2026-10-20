"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mapServerCart, type CartItem, type Product, type ProductSize, type ServerCartItem, type Translate } from "./types";

type CartResponse = { items: ServerCartItem[]; error?: string };

/** The server refused the change (e.g. out of stock); its message is meant for the customer. */
class CartRejected extends Error {}

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
      if (!res.ok) throw new CartRejected(data.error || "");
      if (seq.current === mine && Array.isArray(data.items)) setItems(mapServerCart(data.items));
      return data;
    },
    []
  );

  useEffect(() => {
    send("GET").catch(() => {});
  }, [send]);

  const connectionError = useCallback(
    (e: unknown, rejectedFallback: string) =>
      notify(
        e instanceof CartRejected
          ? e.message || rejectedFallback
          : t("Verbindungsfehler. Bitte versuchen Sie es erneut.", "Connection error. Please try again.")
      ),
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
