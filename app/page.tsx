"use client";

// Storefront home page. The pieces live in app/_store/ (a private folder, not a route).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { CartDrawer } from "./_store/CartDrawer";
import { Catalog } from "./_store/Catalog";
import { CheckoutModal } from "./_store/CheckoutModal";
import { FreshBand, Hero, Story, Visit } from "./_store/HomeSections";
import { ProductDetailModal } from "./_store/ProductDetailModal";
import { SiteFooter } from "./_store/SiteFooter";
import { SiteHeader } from "./_store/SiteHeader";
import type { Product } from "./_store/types";
import { useCart } from "./_store/useCart";
import { useStoreData, useWishlist } from "./_store/useStoreData";

/** Short-lived confirmation message at the bottom of the screen. */
function useToast() {
  const [message, setMessage] = useState("");
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((text: string) => {
    setMessage(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(""), 2200);
  }, []);
  return { message, show };
}

/** Fades sections in as they scroll into view (CSS class .reveal → .is-visible). */
function useRevealOnScroll(deps: unknown) {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll<HTMLElement>(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [deps]);
}

export default function Home() {
  const { language, setLanguage, t } = useLanguage();
  const toast = useToast();
  const { products, loading, error, settings, slots, account, openState } = useStoreData(language);
  const cart = useCart(t, toast.show);
  const wishlist = useWishlist(account);

  const [query, setQuery] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  // Recently viewed, for this visit only. Kept in memory rather than on the device:
  // storing it would need consent under §25 TDDDG, since it isn't strictly necessary.
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useRevealOnScroll(products);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const activeProduct = activeProductId ? byId.get(activeProductId) ?? null : null;
  const recentlyViewed = useMemo(() => recentIds.map((id) => byId.get(id)).filter((p): p is Product => !!p), [recentIds, byId]);

  const openProduct = useCallback((p: Product | string) => {
    const id = typeof p === "string" ? p : p.id;
    setActiveProductId(id);
    setRecentIds((ids) => [id, ...ids.filter((x) => x !== id)].slice(0, 10));
  }, []);
  const closeMobileSearch = useCallback(() => setMobileSearchOpen(false), []);
  const { add } = cart;
  const showToast = toast.show;

  useEffect(() => {
    // Remove the list older versions of the site saved on the device.
    try {
      localStorage.removeItem("almadina_recently_viewed");
    } catch {
      /* ignore */
    }
    // Coming from the /cart page's "Go to checkout" link.
    if (new URLSearchParams(window.location.search).get("checkout") === "1") {
      setCheckoutOpen(true);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  // Reorder: ?reorder=<orderId> arrives from the account page's "Reorder" button.
  const reorderDone = useRef(false);
  useEffect(() => {
    if (products.length === 0 || reorderDone.current) return;
    const reorderId = new URLSearchParams(window.location.search).get("reorder");
    if (!reorderId) return;
    reorderDone.current = true;
    fetch(`/api/account/orders/${reorderId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((order: { items: { sizeId: string | null; qty: number }[] } | null) => {
        if (!order) return;
        let added = 0;
        for (const it of order.items) {
          const product = it.sizeId ? products.find((p) => p.sizes.some((s) => s.id === it.sizeId)) : undefined;
          const size = product?.sizes.find((s) => s.id === it.sizeId);
          if (product && size) {
            add(product, size, it.qty, true);
            added++;
          }
        }
        showToast(
          added > 0
            ? t(`${added} Artikel aus Ihrer letzten Bestellung hinzugefügt`, `Added ${added} items from your past order`)
            : t("Diese Artikel sind leider nicht mehr verfügbar", "Sorry, those items are no longer available")
        );
        window.history.replaceState({}, "", "/");
      })
      .catch(() => {});
  }, [products, add, showToast, t]);

  function finishOrder() {
    cart.clear();
    setCheckoutOpen(false);
    setCartOpen(false);
  }

  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#18201b]">
      <SiteHeader
        settings={settings}
        account={account}
        cartCount={cart.count}
        query={query}
        onQueryChange={setQuery}
        onOpenCart={() => setCartOpen(true)}
        onOpenMobileSearch={() => setMobileSearchOpen(true)}
        language={language}
        setLanguage={setLanguage}
        t={t}
      />

      <Hero openState={openState} t={t} />

      <Catalog
        products={products}
        loading={loading}
        error={error}
        query={query}
        onQueryChange={setQuery}
        mobileSearchOpen={mobileSearchOpen}
        onCloseMobileSearch={closeMobileSearch}
        liked={wishlist.liked}
        recentlyViewed={recentlyViewed}
        onLike={wishlist.toggle}
        onAdd={add}
        onOpen={openProduct}
        t={t}
      />

      <FreshBand t={t} />
      <Story t={t} />
      <Visit openState={openState} t={t} />
      <SiteFooter t={t} />

      {toast.message && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast.message}
        </div>
      )}

      {cartOpen && (
        <CartDrawer
          items={cart.items}
          count={cart.count}
          subtotal={cart.subtotal}
          settings={settings}
          onChangeQty={cart.changeQty}
          onCheckout={() => setCheckoutOpen(true)}
          onClose={() => setCartOpen(false)}
          t={t}
        />
      )}

      {checkoutOpen && (
        <CheckoutModal
          cart={cart.items}
          subtotal={cart.subtotal}
          account={account}
          settings={settings}
          slots={slots}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={finishOrder}
          t={t}
        />
      )}

      {activeProduct && (
        <ProductDetailModal
          key={activeProduct.id}
          product={activeProduct}
          account={account}
          liked={wishlist.liked.includes(activeProduct.id)}
          onLike={() => wishlist.toggle(activeProduct.id)}
          onClose={() => setActiveProductId(null)}
          onAdd={(size) => add(activeProduct, size)}
          onOpenRelated={openProduct}
          t={t}
        />
      )}
    </main>
  );
}
