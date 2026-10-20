"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpDown, Search, Tag, X } from "lucide-react";
import { ALL, OFFERS, categoryKeys, filterAndSort, topRated } from "./catalog-filters";
import { ProductCard } from "./ProductCard";
import type { Product, ProductSize, SortOption, Translate } from "./types";

/** How many products to render at first and per "show more" click. */
const PAGE_SIZE = 24;

type Props = {
  products: Product[];
  loading: boolean;
  error: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  mobileSearchOpen: boolean;
  onCloseMobileSearch: () => void;
  liked: string[];
  recentlyViewed: Product[];
  onLike: (id: string) => void;
  onAdd: (product: Product, size: ProductSize) => void;
  onOpen: (product: Product) => void;
  t: Translate;
};

function Rail({ title, eyebrow, products, ...card }: { title: string; eyebrow: string; products: Product[] } & CardProps) {
  if (products.length === 0) return null;
  return (
    <div style={{ marginTop: 48 }}>
      <div className="section-head">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2 style={{ fontSize: 26 }}>{title}</h2>
        </div>
      </div>
      <Grid products={products} {...card} />
    </div>
  );
}

type CardProps = Pick<Props, "liked" | "onLike" | "onAdd" | "onOpen" | "t">;

function Grid({ products, liked, onLike, onAdd, onOpen, t }: { products: Product[] } & CardProps) {
  return (
    <div className="product-grid">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} liked={liked.includes(p.id)} onLike={onLike} onAdd={onAdd} onOpen={onOpen} t={t} />
      ))}
    </div>
  );
}

/** The shop section: category/tag filters, sorting, search, the product grid and the recommendation rails. */
export function Catalog(props: Props) {
  const { products, loading, error, query, onQueryChange, mobileSearchOpen, onCloseMobileSearch, recentlyViewed, t } = props;
  const card: CardProps = { liked: props.liked, onLike: props.onLike, onAdd: props.onAdd, onOpen: props.onOpen, t };

  const [category, setCategory] = useState(ALL);
  const [sort, setSort] = useState<SortOption>("relevance");
  const [tag, setTag] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const categories = useMemo(() => categoryKeys(products), [products]);
  // categoryKey -> label in the current language, for the filter chips.
  const categoryLabels = useMemo(() => new Map(products.map((p) => [p.categoryKey, p.category])), [products]);
  const allTags = useMemo(() => [...new Set(products.flatMap((p) => p.tags ?? []))].sort(), [products]);
  const filtered = useMemo(() => filterAndSort(products, { category, query, tag, sort }), [products, category, query, tag, sort]);
  const recommended = useMemo(() => topRated(products), [products]);

  // Start from the top of the list whenever the filters change.
  useEffect(() => setVisible(PAGE_SIZE), [category, query, tag, sort]);

  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  // Mobile search: scroll into view + focus when opened from the menu; close on an outside tap.
  useEffect(() => {
    if (!mobileSearchOpen) return;
    mobileSearchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    mobileSearchInputRef.current?.focus();
    function handleOutsideClick(e: MouseEvent) {
      if (mobileSearchRef.current && !mobileSearchRef.current.contains(e.target as Node)) onCloseMobileSearch();
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [mobileSearchOpen, onCloseMobileSearch]);

  const categoryLabel = (c: string) => (c === ALL ? t("Alle", "All") : c === OFFERS ? t("🏷 Angebote", "🏷 Offers") : (categoryLabels.get(c) ?? c));

  return (
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
              {categoryLabel(c)}
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
          {allTags.map((x) => (
            <button key={x} className={tag === x ? "tag-chip active" : "tag-chip"} aria-pressed={tag === x} onClick={() => setTag(tag === x ? null : x)}>
              {x}
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
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t("Produkte suchen…", "Search products…")}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCloseMobileSearch();
            }}
          />
          <button onClick={onCloseMobileSearch} aria-label={t("Suche schließen", "Close search")}>
            <X size={16} />
          </button>
        </div>
      )}

      {loading && <div className="empty">{t("Produkte werden geladen…", "Loading products…")}</div>}
      {!loading && <Grid products={filtered.slice(0, visible)} {...card} />}
      {!loading && filtered.length > visible && (
        <div className="show-more">
          <button className="outline-btn" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            {t("Mehr anzeigen", "Show more")} ({filtered.length - visible})
          </button>
        </div>
      )}
      {!loading && error && (
        <div className="empty">{t("Produkte konnten nicht geladen werden. Bitte laden Sie die Seite neu.", "Couldn't load products. Please refresh the page.")}</div>
      )}
      {!loading && !error && filtered.length === 0 && <div className="empty">{t("Keine Produkte gefunden.", "No products found. Try another search or category.")}</div>}

      <Rail eyebrow={t("Ihr Verlauf", "Your history")} title={t("Zuletzt angesehen", "Recently viewed")} products={recentlyViewed} {...card} />
      <Rail eyebrow={t("Von Kunden geliebt", "Loved by customers")} title={t("Am besten bewertet", "Top rated")} products={recommended} {...card} />
    </section>
  );
}
