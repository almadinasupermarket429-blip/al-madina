// Pure catalog logic (no React), so it can be unit-tested on its own.
import type { Product, SortOption } from "./types";

export const ALL = "All";
export const OFFERS = "Offers";

function isOnSale(p: Product): boolean {
  return p.sizes.some((s) => s.oldPrice != null && s.oldPrice > s.price);
}

/** Category filter chips: "All", then "Offers" if anything is discounted, then categories in catalog order. */
export function categoryKeys(products: Product[]): string[] {
  const list = [ALL, ...new Set(products.map((p) => p.categoryKey).filter(Boolean))];
  if (products.some(isOnSale)) list.splice(1, 0, OFFERS);
  return list;
}

export type CatalogFilter = { category: string; query: string; tag: string | null; sort: SortOption };

export function filterAndSort(products: Product[], f: CatalogFilter): Product[] {
  const q = f.query.trim().toLowerCase();
  const matches = products.filter(
    (p) =>
      (f.category === ALL || (f.category === OFFERS ? isOnSale(p) : p.categoryKey === f.category)) &&
      (q === "" || p.searchText.includes(q)) &&
      (!f.tag || p.tags.includes(f.tag))
  );
  const price = (p: Product) => p.sizes[0]?.price ?? 0;
  if (f.sort === "price-asc") return [...matches].sort((a, b) => price(a) - price(b));
  if (f.sort === "price-desc") return [...matches].sort((a, b) => price(b) - price(a));
  if (f.sort === "rating") return [...matches].sort((a, b) => b.ratingAverage - a.ratingAverage || b.ratingCount - a.ratingCount);
  return matches;
}

/** "Top rated" rail: rated products, best first. */
export function topRated(products: Product[], limit = 6): Product[] {
  return products
    .filter((p) => p.ratingCount > 0)
    .sort((a, b) => b.ratingAverage - a.ratingAverage || b.ratingCount - a.ratingCount)
    .slice(0, limit);
}

/** Amount (in euros) still missing before free delivery, never negative. */
export function remainingForFreeDelivery(subtotal: number, threshold: number): number {
  return Math.max(0, Math.round((threshold - subtotal) * 100) / 100);
}

export function salePercent(price: number, oldPrice: number): number {
  return Math.round((1 - price / oldPrice) * 100);
}
