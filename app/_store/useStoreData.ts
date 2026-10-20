"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_SETTINGS, type StoreSettings } from "@/lib/settings-shared";
import { storeOpenState } from "@/lib/store-info";
import { localizeProduct, type Account, type Language, type RawProduct, type Slot } from "./types";

/** Everything the storefront loads on mount: catalog, shop settings, time slots and the signed-in customer. */
export function useStoreData(language: Language) {
  const [rawProducts, setRawProducts] = useState<RawProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [openState, setOpenState] = useState<ReturnType<typeof storeOpenState> | null>(null);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => {
        if (!res.ok) throw new Error(`Products request failed: ${res.status}`);
        return res.json();
      })
      .then((data) => setRawProducts(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error("[storefront] failed to load products", err);
        setError(true);
      })
      .finally(() => setLoading(false));

    fetch("/api/store")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setSettings(data.settings);
        setSlots(data.slots ?? []);
      })
      .catch(() => {});

    fetch("/api/account/me")
      .then((res) => res.json())
      .then((data) => setAccount(data.user))
      .catch(() => setAccount(null));

    // Computed client-side only so the server-rendered HTML never disagrees with the visitor's clock.
    setOpenState(storeOpenState());
    const timer = setInterval(() => setOpenState(storeOpenState()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const products = useMemo(() => rawProducts.map((p) => localizeProduct(p, language)), [rawProducts, language]);

  return { products, loading, error, settings, slots, account, openState };
}

/** Wishlist ids; saved to the account when signed in. */
export function useWishlist(account: Account | null) {
  const [liked, setLiked] = useState<string[]>([]);

  useEffect(() => {
    if (!account) return;
    fetch("/api/account/wishlist")
      .then((res) => res.json())
      .then((items: { id: string }[]) => setLiked(items.map((p) => p.id)))
      .catch(() => {});
  }, [account]);

  const toggle = useCallback(
    (id: string) => {
      const isLiked = liked.includes(id);
      setLiked((cur) => (isLiked ? cur.filter((x) => x !== id) : [...cur, id]));
      if (!account) return;
      const req = isLiked
        ? fetch(`/api/account/wishlist/${id}`, { method: "DELETE" })
        : fetch("/api/account/wishlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: id }) });
      req.catch(() => {});
    },
    [liked, account]
  );

  return { liked, toggle };
}
