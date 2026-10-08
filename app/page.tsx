"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";
import {
  ArrowRight,
  Check,
  Clock3,
  Heart,
  Leaf,
  MapPin,
  Minus,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Truck,
  X,
  Instagram,
  Facebook,
  User,
  ArrowUpDown,
  Menu,
  Navigation,
  Tag,
  Beef,
  Ticket,
  CalendarClock,
  Repeat,
} from "lucide-react";
import { STORE, OPENING_HOURS, storeOpenState } from "@/lib/store-info";
import { DEFAULT_SETTINGS, deliveryFeeFor, type StoreSettings } from "@/lib/settings-shared";

const MAP_URL = STORE.mapUrl;
const PHONE = STORE.phoneDisplay;
const PHONE_LINK = `tel:${STORE.phoneE164}`;

type Slot = { id: string; date: string; start: string; end: string; remaining: number };

/** Swaps a dead product photo (e.g. a removed Unsplash image) for the store logo instead of a broken-image icon. */
function imageFallback(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.dataset.fallback) return;
  img.dataset.fallback = "1";
  img.src = "/logo.png";
  img.style.objectFit = "contain";
  img.style.padding = "18%";
  img.style.background = "#f3efe6";
}

function slotLabel(slot: { date: string; start: string; end: string }, language: string) {
  const d = new Date(`${slot.date}T12:00:00Z`).toLocaleDateString(language === "de" ? "de-DE" : "en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
  return `${d}, ${slot.start}–${slot.end}`;
}

type ProductSize = { id: string; label: string; price: number; oldPrice: number | null; stock: number };
type Product = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  image: string;
  badge: string | null;
  unitNote: string | null;
  tags: string[];
  slug: string;
  sizes: ProductSize[];
  ratingAverage: number;
  ratingCount: number;
};

type SortOption = "relevance" | "price-asc" | "price-desc" | "rating";
type Account = { id: string; name: string; email: string; phone: string | null };

type CartItem = {
  key: string; // the server-side cart_item id
  productId: string;
  sizeId: string;
  name: string;
  sizeLabel: string;
  price: number;
  image: string;
  qty: number;
  stock: number;
};

type ServerCartItem = {
  id: string;
  variant_id: string;
  quantity: number;
  size_label: string;
  price: number;
  stock_quantity: number;
  product_id: string;
  product_name: string;
  image_url: string | null;
};

function mapServerCart(items: ServerCartItem[]): CartItem[] {
  return items.map((it) => ({
    key: it.id,
    productId: it.product_id,
    sizeId: it.variant_id,
    name: it.product_name,
    sizeLabel: it.size_label,
    price: it.price,
    image: it.image_url ?? "",
    qty: it.quantity,
    stock: it.stock_quantity,
  }));
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [liked, setLiked] = useState<string[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [toast, setToast] = useState("");
  const { language, setLanguage, t } = useLanguage();
  const [sort, setSort] = useState<SortOption>("relevance");
  const [account, setAccount] = useState<Account | null>(null);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>([]);

  const [productsError, setProductsError] = useState(false);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [openState, setOpenState] = useState<ReturnType<typeof storeOpenState> | null>(null);

  useEffect(() => {
    fetch("/api/store")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setSettings(data.settings);
        setSlots(data.slots ?? []);
      })
      .catch(() => {});
    // Computed client-side only so the server-rendered HTML never disagrees with the visitor's clock.
    setOpenState(storeOpenState());
    const timer = setInterval(() => setOpenState(storeOpenState()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Cart-fetch responses can arrive out of order (e.g. the initial GET on
  // mount racing a near-instant "add to cart" click) — this guards against
  // a stale response clobbering a newer one.
  const cartSeqRef = useRef(0);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => {
        if (!res.ok) throw new Error(`Products request failed: ${res.status}`);
        return res.json();
      })
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error("[storefront] failed to load products", err);
        setProductsError(true);
      })
      .finally(() => setLoadingProducts(false));
  }, []);

  useEffect(() => {
    fetch("/api/account/me")
      .then((res) => res.json())
      .then((data) => setAccount(data.user))
      .catch(() => setAccount(null));
  }, []);

  // Load the cart (guest or account, whichever this browser already has) once on mount.
  useEffect(() => {
    const seq = ++cartSeqRef.current;
    fetch("/api/cart")
      .then((res) => res.json())
      .then((data) => {
        if (cartSeqRef.current === seq) setCart(mapServerCart(data.items));
      })
      .catch(() => {});
  }, []);

  // Coming from the /cart page's "Go to checkout" link.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("checkout") === "1") {
      setCheckoutOpen(true);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  // Mobile search bar: scroll it into view + focus when opened from the hamburger menu,
  // and auto-close on an outside tap since it isn't needed once you're done with it.
  useEffect(() => {
    if (!mobileSearchOpen) return;
    mobileSearchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    mobileSearchInputRef.current?.focus();

    function handleOutsideClick(e: MouseEvent) {
      if (mobileSearchRef.current && !mobileSearchRef.current.contains(e.target as Node)) {
        setMobileSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [mobileSearchOpen]);

  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [products]);

  const categories = useMemo(() => {
    const list = ["All", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))];
    if (products.some((p) => p.sizes.some((s) => s.oldPrice && s.oldPrice > s.price))) list.splice(1, 0, "Offers");
    return list;
  }, [products]);
  const allTags = useMemo(() => Array.from(new Set(products.flatMap((p) => p.tags ?? []))).sort(), [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = products.filter((p) => {
      const matchesCategory =
        category === "All" || (category === "Offers" ? p.sizes.some((s) => s.oldPrice && s.oldPrice > s.price) : p.category === category);
      const haystack = `${p.name} ${p.category} ${p.description ?? ""} ${(p.tags ?? []).join(" ")}`.toLowerCase();
      const matchesQuery = q === "" || haystack.includes(q);
      const matchesTag = !tagFilter || (p.tags ?? []).includes(tagFilter);
      return matchesCategory && matchesQuery && matchesTag;
    });

    const sorted = [...matches];
    if (sort === "price-asc") sorted.sort((a, b) => (a.sizes[0]?.price ?? 0) - (b.sizes[0]?.price ?? 0));
    else if (sort === "price-desc") sorted.sort((a, b) => (b.sizes[0]?.price ?? 0) - (a.sizes[0]?.price ?? 0));
    else if (sort === "rating") sorted.sort((a, b) => b.ratingAverage - a.ratingAverage || b.ratingCount - a.ratingCount);
    return sorted;
  }, [products, category, query, sort, tagFilter]);

  // "Customers also liked" — top-rated products, shown as a recommendations rail.
  const recommended = useMemo(
    () =>
      [...products]
        .filter((p) => p.ratingCount > 0)
        .sort((a, b) => b.ratingAverage - a.ratingAverage || b.ratingCount - a.ratingCount)
        .slice(0, 6),
    [products]
  );

  const recentlyViewed = useMemo(
    () => recentlyViewedIds.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[],
    [products, recentlyViewedIds]
  );

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  function addToCart(product: Product, size: ProductSize, qty: number = 1, silent: boolean = false) {
    const seq = ++cartSeqRef.current;
    fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId: size.id, quantity: qty }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          showToast(data.error || t("Konnte nicht hinzugefügt werden", "Couldn't add that to your basket"));
          return;
        }
        if (cartSeqRef.current === seq) setCart(mapServerCart(data.items));
        if (!silent) showToast(t(`${product.name} (${size.label}) wurde hinzugefügt`, `${product.name} (${size.label}) added to your basket`));
      })
      .catch(() => showToast(t("Verbindungsfehler. Bitte versuchen Sie es erneut.", "Connection error. Please try again.")));
  }

  function changeQty(key: string, delta: number) {
    const current = cart.find((item) => item.key === key);
    if (!current) return;
    const nextQty = current.qty + delta;

    const seq = ++cartSeqRef.current;
    fetch("/api/cart", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: key, quantity: nextQty }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          showToast(data.error || t("Konnte nicht aktualisiert werden", "Couldn't update that item"));
          return;
        }
        if (cartSeqRef.current === seq) setCart(mapServerCart(data.items));
      })
      .catch(() => showToast(t("Verbindungsfehler. Bitte versuchen Sie es erneut.", "Connection error. Please try again.")));
  }

  function toggleLike(id: string) {
    const isLiked = liked.includes(id);
    setLiked((current) => (isLiked ? current.filter((x) => x !== id) : [...current, id]));
    if (account) {
      if (isLiked) fetch(`/api/account/wishlist/${id}`, { method: "DELETE" }).catch(() => {});
      else fetch("/api/account/wishlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: id }) }).catch(() => {});
    }
  }

  // Load the customer's saved wishlist once we know who they are.
  useEffect(() => {
    if (!account) return;
    fetch("/api/account/wishlist")
      .then((res) => res.json())
      .then((items: Product[]) => setLiked(items.map((p) => p.id)));
  }, [account]);

  // Track recently viewed products locally (per device), Amazon-style.
  function trackRecentlyViewed(id: string) {
    try {
      const raw = localStorage.getItem("almadina_recently_viewed");
      const ids: string[] = raw ? JSON.parse(raw) : [];
      const next = [id, ...ids.filter((x) => x !== id)].slice(0, 10);
      localStorage.setItem("almadina_recently_viewed", JSON.stringify(next));
      setRecentlyViewedIds(next);
    } catch {
      /* localStorage unavailable — recently-viewed just won't persist */
    }
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem("almadina_recently_viewed");
      if (raw) setRecentlyViewedIds(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  // Reorder: ?reorder=<orderId> arrives from the account page's "Reorder" button.
  useEffect(() => {
    if (products.length === 0) return;
    const reorderId = new URLSearchParams(window.location.search).get("reorder");
    if (!reorderId) return;

    fetch(`/api/account/orders/${reorderId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((order: { items: { sizeId: string | null; qty: number }[] } | null) => {
        if (!order) return;
        let added = 0;
        for (const it of order.items) {
          if (!it.sizeId) continue;
          for (const p of products) {
            const size = p.sizes.find((s) => s.id === it.sizeId);
            if (size) {
              addToCart(p, size, it.qty, true);
              added++;
              break;
            }
          }
        }
        showToast(
          added > 0
            ? t(`${added} Artikel aus Ihrer letzten Bestellung hinzugefügt`, `Added ${added} items from your past order`)
            : t("Diese Artikel sind leider nicht mehr verfügbar", "Sorry, those items are no longer available")
        );
        window.history.replaceState({}, "", "/");
      });
  }, [products]);

  function clearCartAfterOrder() {
    cartSeqRef.current++;
    fetch("/api/cart", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
    setCart([]);
    setCheckoutOpen(false);
    setCartOpen(false);
  }

  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#18201b]">
      <div className="topbar">
        {!settings.acceptingOrders ? (
          <strong>{settings.closedMessage}</strong>
        ) : settings.announcement ? (
          <strong>{settings.announcement}</strong>
        ) : (
          <>
            {t("Kostenlose Abholung in Schweinfurt", "Free pickup in Schweinfurt")}
            {settings.freeDeliveryThreshold > 0 && (
              <>
                {" "}
                · <strong>€{settings.freeDeliveryThreshold}+</strong> {t("für kostenlose Lieferung", "for free delivery")}
              </>
            )}{" "}
            · {t("Zahlung bar bei Lieferung/Abholung", "Cash on delivery/pickup")}
          </>
        )}
      </div>

      <header className="sticky top-0 z-40 border-b border-black/5 bg-[#f8f7f3]/95 backdrop-blur-xl">
        <div className="nav-row">
          <a href="#top" className="header-logo group nav-left" aria-label="Al-Madina home">
            <img src="/logo.png" alt="Al-Madina Markt logo" className="logo-image" />
            <span className="header-logo-text">
              <b>al-madina</b>
              <small>market · seit 1998</small>
            </span>
          </a>

          <div className="nav-center">
            <nav className="nav-links">
              <a href="#shop">Shop</a>
              <a href="#fresh">{t("Täglich frisch", "Fresh daily")}</a>
              <a href="#story">{t("Unsere Geschichte", "Our story")}</a>
              <a href="#visit">{t("Besuchen Sie uns", "Visit us")}</a>
            </nav>
            <div className="nav-search">
              <Search size={18} className="text-black/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Produkte suchen…", "Search products…")}
                className="ml-2 w-full bg-transparent text-sm outline-none"
              />
            </div>
          </div>

          <div className="nav-right">
            <div className="nav-extra">
              <button onClick={() => setLanguage(language === "de" ? "en" : "de")} className="language-btn" aria-label={t("Sprache wechseln", "Change language")}>
                {language === "de" ? "English" : "Deutsch"}
              </button>
              <a className="icon-btn hidden sm:flex" href={PHONE_LINK} aria-label={t("Al-Madina anrufen", "Call Al-Madina")}>
                <Phone size={19} />
              </a>
              <a className="icon-btn" href="/track" aria-label={t("Bestellung verfolgen", "Track order")} title={t("Bestellung verfolgen", "Track order")}>
                <Truck size={19} />
              </a>
              <a className="icon-btn" href="/account" aria-label={t("Mein Konto", "My account")} title={account ? account.name : t("Anmelden", "Sign in")}>
                <User size={19} />
              </a>
            </div>
            <button className="cart-btn" onClick={() => setCartOpen(true)} aria-label="Open basket">
              <ShoppingBag size={19} />
              <span>{t("Warenkorb", "Basket")}</span>
              <i>{cartCount}</i>
            </button>
            <button className="nav-toggle" onClick={() => setMobileNavOpen(true)} aria-label={t("Menü öffnen", "Open menu")}>
              <Menu size={19} />
            </button>
          </div>
        </div>
      </header>

      {mobileNavOpen && (
        <div className="drawer-backdrop" onClick={() => setMobileNavOpen(false)}>
          <aside className="mobile-nav-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span className="header-logo-text">
                <b style={{ fontSize: 18 }}>al-madina</b>
              </span>
              <button onClick={() => setMobileNavOpen(false)} className="icon-btn" aria-label={t("Menü schließen", "Close menu")}>
                <X size={18} />
              </button>
            </div>
            <button
              onClick={() => {
                setMobileNavOpen(false);
                setMobileSearchOpen(true);
              }}
            >
              <Search size={17} /> {t("Produkte suchen", "Search products")}
            </button>
            <div className="mobile-nav-divider" />
            <a href="#shop" onClick={() => setMobileNavOpen(false)}>
              Shop
            </a>
            <a href="#fresh" onClick={() => setMobileNavOpen(false)}>
              {t("Täglich frisch", "Fresh daily")}
            </a>
            <a href="#story" onClick={() => setMobileNavOpen(false)}>
              {t("Unsere Geschichte", "Our story")}
            </a>
            <a href="#visit" onClick={() => setMobileNavOpen(false)}>
              {t("Besuchen Sie uns", "Visit us")}
            </a>
            <div className="mobile-nav-divider" />
            <a href="/track" onClick={() => setMobileNavOpen(false)}>
              <Truck size={17} /> {t("Bestellung verfolgen", "Track order")}
            </a>
            <a href="/account" onClick={() => setMobileNavOpen(false)}>
              <User size={17} /> {account ? account.name : t("Anmelden", "Sign in")}
            </a>
            <a href={PHONE_LINK} onClick={() => setMobileNavOpen(false)}>
              <Phone size={17} /> {PHONE}
            </a>
            <div className="mobile-nav-divider" />
            <button
              onClick={() => {
                setLanguage(language === "de" ? "en" : "de");
                setMobileNavOpen(false);
              }}
            >
              {language === "de" ? "English" : "Deutsch"}
            </button>
          </aside>
        </div>
      )}

      <section id="top" className="hero reveal mx-auto grid max-w-7xl gap-6 px-5 pb-8 pt-6 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:pt-10">
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles size={15} /> {t("Authentischer Geschmack. Jeden Tag frisch.", "Authentic taste. Fresh every day.")}
          </div>
          <h1>
            {t("Ihr arabischer & türkischer Markt,", "Your Arabic & Turkish market,")}
            <br />
            <em>{t("ganz in Ihrer Nähe.", "right around the corner.")}</em>
          </h1>
          <p>
            {t(
              "Supermarkt und Halal-Metzgerei unter einem Dach: frisches Fleisch, Gemüse, warmes Brot, Olivenöl, Gewürze, Meze und Süßigkeiten – sorgfältig für Ihren Alltag ausgewählt.",
              "Supermarket and halal butcher under one roof: fresh meat, vegetables, warm bread, olive oil, spices, meze and sweets — chosen for your everyday table."
            )}
          </p>
          <div className="hero-actions">
            <a href="#shop" className="primary-btn">
              {t("Markt entdecken", "Explore the market")} <ArrowRight size={18} />
            </a>
            <a href={MAP_URL} target="_blank" rel="noreferrer" className="text-btn">
              <MapPin size={17} /> {t("Unser Geschäft finden", "Find our store")}
            </a>
          </div>
          <div className="trust-row">
            {openState && (
              <span className={openState.open ? "open-badge open" : "open-badge"}>
                <i />
                {openState.open
                  ? t(`Jetzt geöffnet · bis ${openState.closesAt} Uhr`, `Open now · until ${openState.closesAt}`)
                  : t(`Geschlossen · öffnet ${openState.nextOpen ?? ""}`, `Closed · opens ${openState.nextOpen ?? ""}`)}
              </span>
            )}
            <span>
              <Check /> {t("Täglich frisch", "Fresh daily")}
            </span>
            <span>
              <Check /> {t("Halal-Metzgerei", "Halal butcher")}
            </span>
            <span>
              <Check /> {t("Familiengeführt", "Family run")}
            </span>
          </div>
        </div>
        <div className="hero-image-wrap">
          <img src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1400&q=88" alt="Fresh vegetables at a market" className="hero-image" />
          <div className="hero-card">
            <span>{t("Heute auf dem Markt", "In the market today")}</span>
            <b>
              {t("Frische Produkte", "Fresh produce")}
              <br />
              {t("ab €1,19", "from €1.19")}
            </b>
            <a href="#fresh">
              {t("Frische entdecken", "Discover fresh")} <ArrowRight size={14} />
            </a>
          </div>
          <div className="hero-stamp">
            <Leaf size={22} />
            <span>
              GOOD
              <br />
              <b>FOOD</b>
            </span>
          </div>
        </div>
      </section>

      <section className="benefits reveal">
        <div>
          <Truck />
          <b>{t("Lokale Lieferung", "Local delivery")}</b>
          <span>{t("Schnell & sorgfältig", "Fast & careful")}</span>
        </div>
        <div>
          <Leaf />
          <b>{t("Frische Produkte", "Fresh produce")}</b>
          <span>{t("Täglich ausgewählt", "Selected daily")}</span>
        </div>
        <div>
          <Beef />
          <b>{t("Halal-Metzgerei", "Halal butcher")}</b>
          <span>{t("Frisch an der Theke", "Fresh at the counter")}</span>
        </div>
        <div>
          <Clock3 />
          <b>{t("Mo–Sa geöffnet", "Open Mon–Sat")}</b>
          <span>07:00 — 20:00</span>
        </div>
      </section>

      <section id="shop" className="reveal mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="section-head">
          <div>
            <span className="eyebrow">{t("Die Al-Madina Auswahl", "The Al-Madina selection")}</span>
            <h2>
              {t("Gutes Essen,", "Good food,")} <em>{t("einfach schön.", "simply beautiful.")}</em>
            </h2>
          </div>
          <a href="#visit" className="text-btn">
            {t("Geschäft besuchen", "Visit the store")} <ArrowRight size={16} />
          </a>
        </div>
        <div className="category-row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {categories.map((c) => (
              <button key={c} className={category === c ? "category active" : "category"} onClick={() => setCategory(c)}>
                {c === "All" ? t("Alle", "All") : c === "Offers" ? t("🏷 Angebote", "🏷 Offers") : c}
              </button>
            ))}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "rgba(24,32,27,.65)" }}>
            <ArrowUpDown size={14} />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              style={{ border: "1px solid rgba(0,0,0,.12)", borderRadius: 8, padding: "6px 8px", background: "transparent" }}
            >
              <option value="relevance">{t("Relevanz", "Relevance")}</option>
              <option value="price-asc">{t("Preis aufsteigend", "Price: low to high")}</option>
              <option value="price-desc">{t("Preis absteigend", "Price: high to low")}</option>
              <option value="rating">{t("Beste Bewertung", "Top rated")}</option>
            </select>
          </label>
        </div>
        {allTags.length > 0 && (
          <div className="tag-row" role="group" aria-label={t("Nach Merkmal filtern", "Filter by attribute")}>
            <Tag size={14} />
            {allTags.map((tag) => (
              <button key={tag} className={tagFilter === tag ? "tag-chip active" : "tag-chip"} aria-pressed={tagFilter === tag} onClick={() => setTagFilter(tagFilter === tag ? null : tag)}>
                {tag}
              </button>
            ))}
          </div>
        )}
        {mobileSearchOpen && (
          <div className="mobile-search md:hidden" ref={mobileSearchRef}>
            <Search size={17} />
            <input
              ref={mobileSearchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Produkte suchen…", "Search products…")}
              onKeyDown={(e) => {
                if (e.key === "Enter") setMobileSearchOpen(false);
              }}
            />
            <button onClick={() => setMobileSearchOpen(false)} aria-label={t("Suche schließen", "Close search")}>
              <X size={16} />
            </button>
          </div>
        )}

        {loadingProducts && <div className="empty">{t("Produkte werden geladen…", "Loading products…")}</div>}
        {!loadingProducts && (
          <div className="product-grid">
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                liked={liked.includes(p.id)}
                onLike={() => toggleLike(p.id)}
                onAdd={(size) => addToCart(p, size)}
                onOpen={() => { setActiveProduct(p); trackRecentlyViewed(p.id); }}
                t={t}
              />
            ))}
          </div>
        )}
        {!loadingProducts && productsError && (
          <div className="empty">
            {t("Produkte konnten nicht geladen werden. Bitte laden Sie die Seite neu.", "Couldn't load products. Please refresh the page.")}
          </div>
        )}
        {!loadingProducts && !productsError && filtered.length === 0 && <div className="empty">{t("Keine Produkte gefunden.", "No products found. Try another search or category.")}</div>}

        {recentlyViewed.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <div className="section-head">
              <div>
                <span className="eyebrow">{t("Ihr Verlauf", "Your history")}</span>
                <h2 style={{ fontSize: 26 }}>{t("Zuletzt angesehen", "Recently viewed")}</h2>
              </div>
            </div>
            <div className="product-grid">
              {recentlyViewed.map((p) => (
                <ProductCard
                  key={`rv-${p.id}`}
                  product={p}
                  liked={liked.includes(p.id)}
                  onLike={() => toggleLike(p.id)}
                  onAdd={(size) => addToCart(p, size)}
                  onOpen={() => { setActiveProduct(p); trackRecentlyViewed(p.id); }}
                  t={t}
                />
              ))}
            </div>
          </div>
        )}

        {recommended.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <div className="section-head">
              <div>
                <span className="eyebrow">{t("Von Kunden geliebt", "Loved by customers")}</span>
                <h2 style={{ fontSize: 26 }}>{t("Am besten bewertet", "Top rated")}</h2>
              </div>
            </div>
            <div className="product-grid">
              {recommended.map((p) => (
                <ProductCard
                  key={`rec-${p.id}`}
                  product={p}
                  liked={liked.includes(p.id)}
                  onLike={() => toggleLike(p.id)}
                  onAdd={(size) => addToCart(p, size)}
                  onOpen={() => { setActiveProduct(p); trackRecentlyViewed(p.id); }}
                  t={t}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      <section id="fresh" className="feature-band reveal">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 lg:grid-cols-2 lg:px-8 lg:py-20">
          <div>
            <span className="eyebrow light">{t("Jeden Morgen frisch", "Fresh every morning")}</span>
            <h2>
              {t("Bringen Sie den Markt", "Bring the market")}
              <br />
              <em>{t("in Ihre Küche.", "into your kitchen.")}</em>
            </h2>
            <p>
              {t(
                "Frische Kräuter, reife Tomaten, knackige Gurken und saisonales Obst – ausgewählt, damit Kochen jeden Tag Freude macht.",
                "Fresh herbs, ripe tomatoes, crisp cucumbers and seasonal fruit — chosen so cooking is a joy every day."
              )}
            </p>
            <a href="#shop" className="light-btn">
              {t("Frische Produkte kaufen", "Shop fresh produce")} <ArrowRight size={17} />
            </a>
          </div>
          <div className="feature-photo">
            <img src="https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=88" alt="Fresh produce market display" />
            <div>
              <b>{t("Sorgfältig ausgewählt.", "Carefully chosen.")}</b>
              <span>{t("Qualität, die man sieht.", "Quality you can see.")}</span>
            </div>
          </div>
        </div>
      </section>

      <section id="story" className="story reveal mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[.9fr_1.1fr] lg:px-8">
        <div className="story-photo">
          <img src="https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=1200&q=88" alt="Grocery store shelves" />
        </div>
        <div className="story-copy">
          <span className="eyebrow">{t("Unsere kleine Ecke des Orients", "Our little corner of the Orient")}</span>
          <h2>
            {t("Ein Markt rund um", "A market built around")} <em>{t("die gemeinsame Tafel.", "the shared table.")}</em>
          </h2>
          <p>
            {t(
              "Al-Madina ist ein Nachbarschaftsmarkt für Menschen, die Zutaten, Gastfreundschaft und die kleinen Rituale rund ums Essen schätzen.",
              "Al-Madina is a neighbourhood market for people who value good ingredients, hospitality, and the small rituals around food."
            )}
          </p>
          <div className="quote">
            <div className="stars">★★★★★</div>
            <p>{t("„Eine warme, großzügige Auswahl arabischer, türkischer und mediterraner Favoriten.“", "“A warm, generous selection of Arabic, Turkish and Mediterranean favourites.”")}</p>
          </div>
          <a href={MAP_URL} target="_blank" rel="noreferrer" className="outline-btn">
            <MapPin size={17} /> {t("Route planen", "Get directions")}
          </a>
        </div>
      </section>

      <section id="visit" className="visit reveal">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <div className="visit-grid">
            <div>
              <span className="eyebrow">{t("Kommen Sie vorbei", "Come visit")}</span>
              <h2>
                {t("Wir sehen uns bei", "See you at")} <em>Al-Madina.</em>
              </h2>
              <p className="store-arabic" dir="rtl" lang="ar">
                {STORE.arabicName}
              </p>
              <p>
                {STORE.street}
                <br />
                {STORE.postalCode} {STORE.city}, {t("Deutschland", "Germany")}
              </p>
              <ul className="service-list">
                {STORE.services.map((svc) => (
                  <li key={svc.key}>
                    <Check size={15} /> {t(svc.de, svc.en)}
                  </li>
                ))}
              </ul>
              <div className="visit-links">
                <a href={STORE.directionsUrl} target="_blank" rel="noreferrer">
                  <Navigation size={17} /> {t("Route planen", "Get directions")}
                </a>
                <a href={PHONE_LINK}>
                  <Phone size={17} /> {PHONE}
                </a>
                <a href={MAP_URL} target="_blank" rel="noreferrer">
                  <MapPin size={17} /> Plus Code: {STORE.plusCode}
                </a>
              </div>
              <div className="hours">
                <b style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  {t("Öffnungszeiten", "Opening hours")}
                  {openState && (
                    <span className={openState.open ? "open-badge open" : "open-badge"}>
                      <i />
                      {openState.open ? t("Jetzt geöffnet", "Open now") : t("Geschlossen", "Closed")}
                    </span>
                  )}
                </b>
                {OPENING_HOURS.map((h) => (
                  <span key={h.day} className={openState && new Date().getDay() === h.day ? "today" : undefined}>
                    {t(h.de, h.en)} <strong>{h.open ? `${h.open} — ${h.close}` : t("Geschlossen", "Closed")}</strong>
                  </span>
                ))}
              </div>
            </div>
            <div className="map-card">
              <div className="map-grid"></div>
              <div className="pin">
                <MapPin size={26} />
                <b>Al-Madina</b>
                <small>{STORE.street}</small>
              </div>
              <a href={MAP_URL} target="_blank" rel="noreferrer" className="map-overlay">
                {t("In Google Maps öffnen", "Open in Google Maps")} <ArrowRight size={15} />
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="footer-main">
            <div>
              <a href="#top" className="footer-logo-wrap">
                <img src="/logo.png" alt="Al-Madina Markt logo" className="footer-logo" />
                <span className="header-logo-text">
                  <b>al-madina</b>
                  <small>market · seit 1998</small>
                </span>
              </a>
              <p className="footer-note">{t("Arabische, türkische & mediterrane Lebensmittel und Halal-Fleisch für Ihren Alltag.", "Arabic, Turkish & Mediterranean groceries and halal meat for your everyday table.")}</p>
            </div>
            <div className="footer-links">
              <div>
                <b>{t("Entdecken", "Discover")}</b>
                <a href="#shop">Shop</a>
                <a href="#fresh">{t("Täglich frisch", "Fresh daily")}</a>
                <a href="#story">{t("Unsere Geschichte", "Our story")}</a>
              </div>
              <div>
                <b>{t("Besuchen", "Visit")}</b>
                <a href={MAP_URL} target="_blank" rel="noreferrer">
                  Google Maps
                </a>
                <a href={PHONE_LINK}>{t("Anrufen", "Call")}</a>
                <a href="#visit">{t("Öffnungszeiten", "Opening hours")}</a>
                <span className="footer-hours">
                  {t("Mo–Sa 07:00–20:00", "Mon–Sat 07:00–20:00")}
                  <br />
                  {t("So geschlossen", "Sun closed")}
                </span>
              </div>
              <div>
                <b>{t("Folgen", "Follow")}</b>
                <a href="https://www.instagram.com/" target="_blank" rel="noreferrer">
                  <Instagram size={15} /> Instagram
                </a>
                <a href="https://www.facebook.com/" target="_blank" rel="noreferrer">
                  <Facebook size={15} /> Facebook
                </a>
              </div>
              <div>
                <b>{t("Rechtliches", "Legal")}</b>
                <Link href="/impressum">Impressum</Link>
                <Link href="/datenschutz">{t("Datenschutz", "Privacy Policy")}</Link>
                <Link href="/cookie-einstellungen">{t("Cookie-Einstellungen", "Cookie Settings")}</Link>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <span>
              © {new Date().getFullYear()} {STORE.name} · {STORE.street}, {STORE.postalCode} {STORE.city}
            </span>
            <span>{t("Zahlung ausschließlich in bar bei Lieferung oder Abholung.", "Payment is cash only, on delivery or pickup.")}</span>
          </div>
        </div>
      </footer>

      {toast && (
        <div className="toast">
          <Check size={16} />
          {toast}
        </div>
      )}

      {cartOpen && (
        <div className="drawer-backdrop" onClick={() => setCartOpen(false)}>
          <aside className="cart-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <span className="eyebrow">{t("Ihr Warenkorb", "Your basket")}</span>
                <h3>
                  {cartCount} {t("Artikel", "item")}
                  {cartCount === 1 ? "" : "s"}
                </h3>
              </div>
              <button onClick={() => setCartOpen(false)} className="icon-btn" aria-label={t("Schließen", "Close")}>
                <X />
              </button>
            </div>
            {cart.length === 0 ? (
              <div className="empty-cart">
                <ShoppingBag size={42} />
                <h3>{t("Ihr Warenkorb wartet.", "Your basket is waiting.")}</h3>
                <p>{t("Fügen Sie einige Favoriten hinzu – sie erscheinen hier.", "Add a few favourites — they'll show up here.")}</p>
                <button className="primary-btn" onClick={() => setCartOpen(false)}>
                  {t("Weiter einkaufen", "Continue shopping")}
                </button>
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map((item) => (
                    <div className="cart-item" key={item.key}>
                      <img src={item.image} alt="" onError={imageFallback} />
                      <div>
                        <b>{item.name}</b>
                        <span>
                          {item.sizeLabel} · €{item.price.toFixed(2)}
                        </span>
                        <div className="qty">
                          <button onClick={() => changeQty(item.key, -1)} aria-label={t("Menge verringern", "Decrease quantity")}>
                            <Minus size={13} />
                          </button>
                          <span>{item.qty}</span>
                          <button onClick={() => changeQty(item.key, 1)} disabled={item.qty >= item.stock} aria-label={t("Menge erhöhen", "Increase quantity")}>
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="cart-summary">
                  {settings.deliveryEnabled && settings.freeDeliveryThreshold > 0 && (
                    <div className="free-delivery" style={{ display: "block" }}>
                      <span>
                        {subtotal >= settings.freeDeliveryThreshold
                          ? t("🎉 Kostenlose Lieferung freigeschaltet!", "🎉 You've unlocked free delivery!")
                          : t(
                              `Noch €${(settings.freeDeliveryThreshold - subtotal).toFixed(2)} bis zur kostenlosen Lieferung`,
                              `€${(settings.freeDeliveryThreshold - subtotal).toFixed(2)} away from free delivery`
                            )}
                      </span>
                      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, (subtotal / settings.freeDeliveryThreshold) * 100))}>
                        <i style={{ width: `${Math.min(100, (subtotal / settings.freeDeliveryThreshold) * 100)}%` }} />
                      </div>
                    </div>
                  )}
                  <div>
                    <span>{t("Zwischensumme", "Subtotal")}</span>
                    <b>€{subtotal.toFixed(2)}</b>
                  </div>
                  {settings.minimumOrder > subtotal ? (
                    <small style={{ textAlign: "left", color: "#b3261e" }}>
                      {t(
                        `Mindestbestellwert €${settings.minimumOrder.toFixed(2)} — noch €${(settings.minimumOrder - subtotal).toFixed(2)}.`,
                        `Minimum order €${settings.minimumOrder.toFixed(2)} — add €${(settings.minimumOrder - subtotal).toFixed(2)} more.`
                      )}
                    </small>
                  ) : (
                    <small style={{ textAlign: "left" }}>
                      {t("Lieferkosten & Abholoption werden an der Kasse gewählt.", "Delivery fee / pickup option is chosen at checkout.")}
                    </small>
                  )}
                  {!settings.acceptingOrders && <small style={{ textAlign: "left", color: "#b3261e" }}>{settings.closedMessage}</small>}
                  <button
                    className="primary-btn full"
                    onClick={() => setCheckoutOpen(true)}
                    disabled={!settings.acceptingOrders || settings.minimumOrder > subtotal}
                    style={!settings.acceptingOrders || settings.minimumOrder > subtotal ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                  >
                    {t("Zur Kasse", "Checkout")} <ArrowRight size={17} />
                  </button>
                  <small>{t("Zahlung bar bei Lieferung oder Abholung", "Cash payment on delivery or pickup")}</small>
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      {checkoutOpen && (
        <CheckoutModal
          cart={cart}
          subtotal={subtotal}
          account={account}
          settings={settings}
          slots={slots}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={clearCartAfterOrder}
          t={t}
        />
      )}

      {activeProduct && (
        <ProductDetailModal
          product={activeProduct}
          account={account}
          liked={liked.includes(activeProduct.id)}
          onLike={() => toggleLike(activeProduct.id)}
          onClose={() => setActiveProduct(null)}
          onAdd={(size) => addToCart(activeProduct, size)}
          onOpenRelated={(id) => {
            const p = products.find((pr) => pr.id === id);
            if (p) {
              setActiveProduct(p);
              trackRecentlyViewed(p.id);
            }
          }}
          t={t}
        />
      )}
    </main>
  );
}

function StarRating({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} fill={n <= Math.round(value) ? "currentColor" : "none"} style={{ color: "#d99a2b" }} />
      ))}
    </span>
  );
}

function ProductCard({
  product,
  liked,
  onLike,
  onAdd,
  onOpen,
  t,
}: {
  product: Product;
  liked: boolean;
  onLike: () => void;
  onAdd: (size: ProductSize) => void;
  onOpen: () => void;
  t: (de: string, en: string) => string;
}) {
  const [sizeId, setSizeId] = useState(product.sizes[0]?.id);
  const size = product.sizes.find((s) => s.id === sizeId) ?? product.sizes[0];
  if (!size) return null;

  return (
    <article className="product-card">
      <div className="product-image" onClick={onOpen} style={{ cursor: "pointer" }}>
        <img src={product.image} alt={product.name} onError={imageFallback} />
        {product.badge && <span className="product-badge">{product.badge}</span>}
        {!product.badge && size.oldPrice && size.oldPrice > size.price && (
          <span className="product-badge sale">−{Math.round((1 - size.price / size.oldPrice) * 100)}%</span>
        )}
        {size.stock === 0 && <span className="stock-flag out">{t("Ausverkauft", "Sold out")}</span>}
        {size.stock > 0 && size.stock <= 5 && <span className="stock-flag">{t(`Nur noch ${size.stock}`, `Only ${size.stock} left`)}</span>}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLike();
          }}
          className={liked ? "heart liked" : "heart"}
          aria-label={liked ? t("Aus Wunschliste entfernen", "Remove from wishlist") : t("Zur Wunschliste hinzufügen", "Add to wishlist")}
          aria-pressed={liked}
        >
          <Heart size={18} fill={liked ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="product-info">
        <span className="product-category">
          {product.category}
          {product.tags?.length ? <span className="product-tags"> · {product.tags.slice(0, 2).join(" · ")}</span> : null}
        </span>
        <h3 onClick={onOpen} style={{ cursor: "pointer" }}>
          {product.name}
        </h3>
        {product.ratingCount > 0 ? (
          <button
            onClick={onOpen}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            <StarRating value={product.ratingAverage} />
            <small style={{ color: "rgba(24,32,27,.6)" }}>
              {product.ratingAverage.toFixed(1)} ({product.ratingCount})
            </small>
          </button>
        ) : (
          <button onClick={onOpen} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
            <small style={{ color: "rgba(24,32,27,.45)" }}>{t("Noch keine Bewertungen", "No reviews yet")}</small>
          </button>
        )}

        {product.sizes.length > 1 && (
          <div className="size-row">
            {product.sizes.map((s) => (
              <button key={s.id} className={s.id === size.id ? "size-pill active" : "size-pill"} onClick={() => setSizeId(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div className="product-bottom">
          <div>
            <b>€{size.price.toFixed(2)}</b>
            {product.unitNote && <small> {product.unitNote}</small>}
            {size.oldPrice && <del>€{size.oldPrice.toFixed(2)}</del>}
          </div>
          <button onClick={() => onAdd(size)} className="add-btn" disabled={size.stock === 0} aria-label={t(`${product.name} hinzufügen`, `Add ${product.name}`)}>
            <Plus size={17} />
            <span>{size.stock === 0 ? t("Ausverkauft", "Sold out") : t("Hinzufügen", "Add")}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function CheckoutModal({
  cart,
  subtotal,
  account,
  settings,
  slots,
  onClose,
  onSuccess,
  t,
}: {
  cart: CartItem[];
  subtotal: number;
  account: Account | null;
  settings: StoreSettings;
  slots: Slot[];
  onClose: () => void;
  onSuccess: () => void;
  t: (de: string, en: string) => string;
}) {
  const { language } = useLanguage();
  const [fulfillment, setFulfillment] = useState<"DELIVERY" | "PICKUP">(settings.deliveryEnabled ? "DELIVERY" : "PICKUP");
  const [slotId, setSlotId] = useState("");
  const [substitution, setSubstitution] = useState("CALL");
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number; freeDelivery: boolean; description: string | null } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [name, setName] = useState(account?.name ?? "");
  const [email, setEmail] = useState(account?.email ?? "");
  const [phone, setPhone] = useState(account?.phone ?? "");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [success, setSuccess] = useState<{ orderNumber: string; total: number; slot: Slot | null; fulfillment: string } | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<{ id: string; label: string; address: string; isDefault: boolean }[]>([]);

  useEffect(() => {
    if (!account) return;
    fetch("/api/account/addresses")
      .then((res) => res.json())
      .then((data: { id: string; label: string; address: string; isDefault: boolean }[]) => {
        setSavedAddresses(Array.isArray(data) ? data : []);
        const def = data?.find((a) => a.isDefault) ?? data?.[0];
        if (def) setAddress(def.address);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  const discount = coupon ? Math.min(coupon.discount, subtotal) : 0;
  const deliveryFee = coupon?.freeDelivery ? 0 : deliveryFeeFor(settings, fulfillment, subtotal - discount);
  const total = subtotal - discount + deliveryFee;

  // A coupon's discount depends on the subtotal — drop it if the basket changes underneath it.
  useEffect(() => {
    setCoupon(null);
  }, [subtotal]);

  async function applyCoupon() {
    setCouponError("");
    if (!couponInput.trim()) return;
    setCheckingCoupon(true);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponInput, subtotal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCoupon(null);
        setCouponError(data.error || t("Ungültiger Code.", "Invalid code."));
      } else setCoupon(data);
    } catch {
      setCouponError(t("Verbindungsfehler. Bitte versuchen Sie es erneut.", "Connection error. Please try again."));
    }
    setCheckingCoupon(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNeedsLogin(false);
    setNeedsVerification(false);
    if (fulfillment === "DELIVERY" && !address.trim()) {
      setError(t("Bitte geben Sie Ihre Lieferadresse an.", "Please enter a delivery address."));
      return;
    }
    if (settings.requireSlot && slots.length > 0 && !slotId) {
      setError(t("Bitte wählen Sie ein Zeitfenster.", "Please choose a time slot."));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          customerEmail: email,
          customerPhone: phone,
          fulfillment,
          address: fulfillment === "DELIVERY" ? address : undefined,
          notes,
          couponCode: coupon?.code,
          slotId: slotId || undefined,
          substitution,
          items: cart.map((c) => ({ sizeId: c.sizeId, qty: c.qty })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) setNeedsLogin(true);
        if (data.code === "EMAIL_NOT_VERIFIED") setNeedsVerification(true);
        setError(data.error || t("Bestellung fehlgeschlagen. Bitte versuchen Sie es erneut.", "Could not place order. Please try again."));
        setSubmitting(false);
        return;
      }
      setSuccess({ orderNumber: data.orderNumber, total: data.total, slot: slots.find((s) => s.id === slotId) ?? null, fulfillment });
    } catch {
      setError(t("Verbindungsfehler. Bitte versuchen Sie es erneut.", "Connection error. Please try again."));
    }
    setSubmitting(false);
  }

  if (success) {
    return (
      <div className="modal-backdrop">
        <div className="checkout-modal">
          <button className="close-modal" onClick={onSuccess} aria-label={t("Schließen", "Close")}>
            <X />
          </button>
          <span className="eyebrow">{t("Bestellung aufgegeben", "Order placed")}</span>
          <h2 style={{ fontSize: 40 }}>{t("Vielen Dank!", "Thank you!")}</h2>
          <p>
            {t("Ihre Bestellnummer ist", "Your order number is")} <b>#{success.orderNumber}</b>.{" "}
            {t("Eine Bestätigung wurde an Ihre E-Mail gesendet.", "A confirmation has been sent to your email.")}
          </p>
          {success.slot && (
            <p>
              <CalendarClock size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
              {success.fulfillment === "PICKUP" ? t("Abholung", "Pickup") : t("Lieferung", "Delivery")}: <b>{slotLabel(success.slot, language)}</b>
            </p>
          )}
          <div className="checkout-box">
            <span>{t("Zu zahlen (bar)", "To pay (cash)")}</span>
            <b>€{success.total.toFixed(2)}</b>
          </div>
          <p style={{ fontSize: 12 }}>
            {t("Sie können den Status jederzeit unter", "You can follow the status any time under")}{" "}
            <Link href="/account" style={{ textDecoration: "underline" }}>
              {t("Mein Konto", "My account")}
            </Link>{" "}
            {t("verfolgen.", ".")}
          </p>
          <button className="primary-btn full" onClick={onSuccess}>
            {t("Fertig", "Done")} <Check size={17} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop">
      <form className="checkout-modal" onSubmit={submit} style={{ maxHeight: "90vh", overflow: "auto" }}>
        <button type="button" className="close-modal" onClick={onClose} aria-label={t("Schließen", "Close")}>
          <X />
        </button>
        <span className="eyebrow">{t("Kasse", "Checkout")}</span>
        <h2 style={{ fontSize: 36 }}>{t("Bar bei Lieferung oder Abholung.", "Cash on delivery or pickup.")}</h2>
        <p>{t("Es wird keine Online-Zahlung durchgeführt. Sie zahlen bar bei Erhalt.", "No online payment is taken. You pay in cash when you receive your order.")}</p>

        {!settings.acceptingOrders && <div className="checkout-error">{settings.closedMessage}</div>}

        <div className="fulfillment-toggle">
          {settings.deliveryEnabled && (
            <button type="button" className={fulfillment === "DELIVERY" ? "fulfillment-btn active" : "fulfillment-btn"} onClick={() => setFulfillment("DELIVERY")}>
              <Truck size={16} /> {t("Lieferung", "Delivery")}
            </button>
          )}
          {settings.pickupEnabled && (
            <button type="button" className={fulfillment === "PICKUP" ? "fulfillment-btn active" : "fulfillment-btn"} onClick={() => setFulfillment("PICKUP")}>
              <Store size={16} /> {t("Abholung im Laden", "Pickup in store")}
            </button>
          )}
        </div>
        {fulfillment === "PICKUP" && (
          <p className="pickup-note">
            {t(
              `Wir packen Ihre Bestellung — Abholung im Laden oder am Straßenrand: ${STORE.street}, ${STORE.postalCode} ${STORE.city} (Mo–Sa 07:00–20:00).`,
              `We'll pack your order — pick it up in store or at the kerb: ${STORE.street}, ${STORE.postalCode} ${STORE.city} (Mon–Sat 07:00–20:00).`
            )}
          </p>
        )}
        {fulfillment === "DELIVERY" && settings.deliveryArea && (
          <p className="pickup-note">
            {t("Liefergebiet", "Delivery area")}: {settings.deliveryArea}
            {settings.freeDeliveryThreshold > 0 &&
              ` · ${t(`ab €${settings.freeDeliveryThreshold} kostenlos`, `free from €${settings.freeDeliveryThreshold}`)}`}
          </p>
        )}

        {slots.length > 0 && (
          <label className="checkout-label">
            <span>
              <CalendarClock size={14} /> {fulfillment === "PICKUP" ? t("Abholzeit", "Pickup time") : t("Lieferzeit", "Delivery time")}
              {!settings.requireSlot && <small> ({t("optional", "optional")})</small>}
            </span>
            <select value={slotId} onChange={(e) => setSlotId(e.target.value)} required={settings.requireSlot}>
              <option value="">{settings.requireSlot ? t("Bitte wählen…", "Please choose…") : t("So bald wie möglich", "As soon as possible")}</option>
              {slots.map((s) => (
                <option key={s.id} value={s.id}>
                  {slotLabel(s, language)}
                  {s.remaining <= 2 ? ` — ${t(`noch ${s.remaining} frei`, `${s.remaining} left`)}` : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="checkout-fields">
          <input required placeholder={t("Vollständiger Name", "Full name")} value={name} onChange={(e) => setName(e.target.value)} />
          <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input required placeholder={t("Telefonnummer", "Phone number")} value={phone} onChange={(e) => setPhone(e.target.value)} />
          {fulfillment === "DELIVERY" && (
            <>
              {savedAddresses.length > 0 && (
                <select onChange={(e) => setAddress(e.target.value)} defaultValue={address} style={{ padding: "10px 12px", border: "1px solid rgba(0,0,0,.12)", borderRadius: 8 }}>
                  {savedAddresses.map((a) => (
                    <option key={a.id} value={a.address}>
                      {a.label} — {a.address}
                    </option>
                  ))}
                  <option value="">{t("Andere Adresse eingeben…", "Enter a different address…")}</option>
                </select>
              )}
              <input required placeholder={t("Lieferadresse", "Delivery address")} value={address} onChange={(e) => setAddress(e.target.value)} />
            </>
          )}
          <label className="checkout-label">
            <span>
              <Repeat size={14} /> {t("Falls ein Artikel fehlt", "If an item is unavailable")}
            </span>
            <select value={substitution} onChange={(e) => setSubstitution(e.target.value)}>
              <option value="CALL">{t("Mich anrufen", "Call me")}</option>
              <option value="SUBSTITUTE">{t("Durch ähnlichen Artikel ersetzen", "Replace with a similar item")}</option>
              <option value="REMOVE">{t("Artikel weglassen", "Leave it out")}</option>
            </select>
          </label>
          <textarea
            placeholder={t("Hinweise zur Bestellung (optional, z. B. Klingel, Zuschnitt beim Fleisch)", "Order notes (optional, e.g. doorbell, how to cut the meat)")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={1000}
          />
        </div>

        <div className="coupon-row">
          <Ticket size={16} />
          <input
            placeholder={t("Gutscheincode", "Coupon code")}
            value={couponInput}
            onChange={(e) => {
              setCouponInput(e.target.value.toUpperCase());
              setCouponError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyCoupon();
              }
            }}
            aria-label={t("Gutscheincode", "Coupon code")}
          />
          {coupon ? (
            <button
              type="button"
              onClick={() => {
                setCoupon(null);
                setCouponInput("");
              }}
            >
              {t("Entfernen", "Remove")}
            </button>
          ) : (
            <button type="button" onClick={applyCoupon} disabled={checkingCoupon || !couponInput.trim()}>
              {checkingCoupon ? "…" : t("Einlösen", "Apply")}
            </button>
          )}
        </div>
        {couponError && <div className="checkout-error">{couponError}</div>}
        {coupon && (
          <small style={{ color: "var(--leaf)", display: "block", marginTop: 6 }}>
            <Check size={13} style={{ display: "inline", verticalAlign: "-2px" }} /> {coupon.code}
            {coupon.description ? ` — ${coupon.description}` : ""}
          </small>
        )}

        {error && (
          <div className="checkout-error">
            {error}
            {needsLogin && (
              <>
                {" "}
                <Link href="/account" className="text-btn" style={{ display: "inline-flex", padding: 0 }}>
                  {t("Jetzt anmelden", "Log in now")}
                </Link>
                {" — "}
                {t("Ihr Warenkorb bleibt dabei erhalten.", "your basket will still be here.")}
              </>
            )}
            {needsVerification && (
              <>
                {" "}
                <Link href="/account" className="text-btn" style={{ display: "inline-flex", padding: 0 }}>
                  {t("E-Mail jetzt bestätigen", "Verify your email now")}
                </Link>
                {" — "}
                {t("Ihr Warenkorb bleibt dabei erhalten.", "your basket will still be here.")}
              </>
            )}
          </div>
        )}

        <div className="checkout-box" style={{ flexDirection: "column", gap: 6, alignItems: "stretch" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{t("Zwischensumme", "Subtotal")}</span>
            <span>€{subtotal.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--leaf)" }}>
              <span>
                {t("Rabatt", "Discount")} ({coupon?.code})
              </span>
              <span>−€{discount.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{fulfillment === "PICKUP" ? t("Abholung", "Pickup") : t("Lieferung", "Delivery")}</span>
            <span>{deliveryFee === 0 ? t("Kostenlos", "Free") : `€${deliveryFee.toFixed(2)}`}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 18, borderTop: "1px solid var(--line)", paddingTop: 6 }}>
            <span>{t("Gesamt (bar)", "Total (cash)")}</span>
            <span>€{total.toFixed(2)}</span>
          </div>
        </div>

        <button className="primary-btn full" disabled={submitting || cart.length === 0 || !settings.acceptingOrders}>
          {submitting ? t("Wird gesendet…", "Placing order…") : t("Bestellung aufgeben — Bar bezahlen", "Place order — pay cash")} <Check size={17} />
        </button>
      </form>
    </div>
  );
}

type ReviewData = {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  createdAt: string;
  authorName: string;
};

function ProductDetailModal({
  product,
  account,
  liked,
  onLike,
  onClose,
  onAdd,
  onOpenRelated,
  t,
}: {
  product: Product;
  account: Account | null;
  liked: boolean;
  onLike: () => void;
  onClose: () => void;
  onAdd: (size: ProductSize) => void;
  onOpenRelated: (id: string) => void;
  t: (de: string, en: string) => string;
}) {
  const [sizeId, setSizeId] = useState(product.sizes[0]?.id);
  const size = product.sizes.find((s) => s.id === sizeId) ?? product.sizes[0];

  const [related, setRelated] = useState<{ id: string; name: string; image: string; category: string }[]>([]);

  useEffect(() => {
    fetch(`/api/products/${product.id}/related`)
      .then((res) => res.json())
      .then((data) => setRelated(Array.isArray(data) ? data : []));
  }, [product.id]);

  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [average, setAverage] = useState(product.ratingAverage);
  const [count, setCount] = useState(product.ratingCount);
  const [loadingReviews, setLoadingReviews] = useState(true);

  const [myRating, setMyRating] = useState(5);
  const [myTitle, setMyTitle] = useState("");
  const [myComment, setMyComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  function loadReviews() {
    setLoadingReviews(true);
    fetch(`/api/reviews?productId=${product.id}`)
      .then((res) => res.json())
      .then((data) => {
        setReviews(data.reviews ?? []);
        setAverage(data.average ?? 0);
        setCount(data.count ?? 0);
      })
      .finally(() => setLoadingReviews(false));
  }

  useEffect(() => {
    loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    setReviewError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, rating: myRating, title: myTitle, comment: myComment }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReviewError(data.error || t("Bewertung konnte nicht gespeichert werden.", "Could not save your review."));
        setSubmitting(false);
        return;
      }
      setReviewSubmitted(true);
      setMyTitle("");
      setMyComment("");
      loadReviews();
    } catch {
      setReviewError(t("Verbindungsfehler. Bitte versuchen Sie es erneut.", "Connection error. Please try again."));
    }
    setSubmitting(false);
  }

  if (!size) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="checkout-modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "90vh", overflow: "auto", maxWidth: 640 }}>
        <button type="button" className="close-modal" onClick={onClose} aria-label={t("Schließen", "Close")}>
          <X />
        </button>

        <img src={product.image} alt={product.name} onError={imageFallback} style={{ width: "100%", borderRadius: 14, marginBottom: 16, maxHeight: 260, objectFit: "cover" }} />

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <span className="eyebrow">{product.category}</span>
            <h2 style={{ fontSize: 28 }}>{product.name}</h2>
          </div>
          <button
            onClick={onLike}
            className={liked ? "heart liked" : "heart"}
            aria-label={liked ? t("Aus Wunschliste entfernen", "Remove from wishlist") : t("Zur Wunschliste hinzufügen", "Add to wishlist")}
            aria-pressed={liked}
            style={{ position: "static" }}
          >
            <Heart size={20} fill={liked ? "currentColor" : "none"} />
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0 14px" }}>
          <StarRating value={average} size={16} />
          <span style={{ fontSize: 14, color: "rgba(24,32,27,.65)" }}>
            {count > 0
              ? `${average.toFixed(1)} · ${count} ${t(count === 1 ? "Bewertung" : "Bewertungen", count === 1 ? "review" : "reviews")}`
              : t("Noch keine Bewertungen", "No reviews yet")}
          </span>
        </div>

        {product.description && <p>{product.description}</p>}
        {product.tags?.length > 0 && (
          <div className="tag-row" style={{ margin: "8px 0" }}>
            {product.tags.map((tag) => (
              <span key={tag} className="tag-chip">
                {tag}
              </span>
            ))}
          </div>
        )}
        {product.slug && (
          <Link href={`/products/${product.slug}`} className="text-btn" style={{ fontSize: 12 }}>
            {t("Produktseite öffnen", "Open product page")} <ArrowRight size={13} />
          </Link>
        )}

        {product.sizes.length > 1 && (
          <div className="size-row" style={{ margin: "10px 0" }}>
            {product.sizes.map((s) => (
              <button key={s.id} className={s.id === size.id ? "size-pill active" : "size-pill"} onClick={() => setSizeId(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div className="checkout-box" style={{ marginBottom: 20 }}>
          <div>
            <b>€{size.price.toFixed(2)}</b>
            {product.unitNote && <small> {product.unitNote}</small>}
          </div>
          <button
            className="primary-btn"
            disabled={size.stock === 0}
            style={size.stock === 0 ? { opacity: 0.5 } : undefined}
            onClick={() => {
              onAdd(size);
              onClose();
            }}
          >
            <Plus size={17} /> {size.stock === 0 ? t("Ausverkauft", "Sold out") : t("Hinzufügen", "Add to basket")}
          </button>
        </div>

        {related.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 18, marginBottom: 10 }}>{t("Häufig zusammen gekauft", "Frequently bought together")}</h3>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
              {related.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onOpenRelated(r.id)}
                  style={{ flex: "0 0 auto", width: 96, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  <img src={r.image} alt={r.name} onError={imageFallback} style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 10, marginBottom: 4 }} />
                  <small style={{ display: "block", lineHeight: 1.2 }}>{r.name}</small>
                </button>
              ))}
            </div>
          </div>
        )}

        <h3 style={{ fontSize: 18, marginBottom: 10 }}>{t("Bewertungen", "Reviews")}</h3>


        {account ? (
          reviewSubmitted ? (
            <p style={{ color: "rgba(24,32,27,.7)" }}>
              <Check size={15} style={{ display: "inline", marginRight: 4 }} />
              {t("Danke für Ihre Bewertung!", "Thanks for your review!")}
            </p>
          ) : (
            <form onSubmit={submitReview} style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 4 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setMyRating(n)}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                    aria-label={`${n} stars`}
                  >
                    <Star size={22} fill={n <= myRating ? "currentColor" : "none"} style={{ color: "#d99a2b" }} />
                  </button>
                ))}
              </div>
              <input
                placeholder={t("Titel (optional)", "Title (optional)")}
                value={myTitle}
                onChange={(e) => setMyTitle(e.target.value)}
              />
              <textarea
                placeholder={t("Ihre Bewertung (optional)", "Your review (optional)")}
                value={myComment}
                onChange={(e) => setMyComment(e.target.value)}
                rows={3}
              />
              {reviewError && <div className="checkout-error">{reviewError}</div>}
              <button className="primary-btn" disabled={submitting}>
                {submitting ? t("Wird gesendet…", "Submitting…") : t("Bewertung abgeben", "Submit review")}
              </button>
            </form>
          )
        ) : (
          <p style={{ marginBottom: 20 }}>
            <a href="/account" style={{ textDecoration: "underline" }}>
              {t("Melden Sie sich an", "Sign in")}
            </a>{" "}
            {t("um eine Bewertung zu hinterlassen.", "to leave a review.")}
          </p>
        )}

        {loadingReviews && <div className="empty">{t("Bewertungen werden geladen…", "Loading reviews…")}</div>}
        {!loadingReviews && reviews.length === 0 && (
          <p style={{ color: "rgba(24,32,27,.5)" }}>{t("Seien Sie der Erste, der dieses Produkt bewertet.", "Be the first to review this product.")}</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {reviews.map((r) => (
            <div key={r.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <StarRating value={r.rating} size={13} />
                <b style={{ fontSize: 14 }}>{r.title || r.authorName}</b>
              </div>
              {r.comment && <p style={{ fontSize: 14, marginTop: 4 }}>{r.comment}</p>}
              <small style={{ color: "rgba(24,32,27,.5)" }}>
                {r.authorName} · {new Date(r.createdAt).toLocaleDateString()}
              </small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}