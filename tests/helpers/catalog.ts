// Picks test products from whatever catalog the shop is running on (the live copy or the 6-product
// demo seed), instead of naming real products, so the suite passes on any database.
import type { APIRequestContext } from "@playwright/test";

export type ShopProduct = {
  id: string;
  name: string;
  nameEn: string | null;
  category: string;
  categoryEn: string | null;
  image: string | null;
  active: boolean;
  sortOrder: number;
  categorySortOrder: number;
  sizes: { id: string; label: string; price: number; stock: number }[];
};

/** Every visible product, in the order the shop grid shows them (category order, then product order). */
export async function shopProducts(request: APIRequestContext): Promise<ShopProduct[]> {
  const res = await request.get("/api/products");
  if (!res.ok()) throw new Error(`/api/products answered ${res.status()}`);
  const all: ShopProduct[] = await res.json();
  return all
    .filter((p) => p.active !== false)
    .sort((a, b) => a.categorySortOrder - b.categorySortOrder || a.sortOrder - b.sortOrder);
}

/**
 * A product the grid shows on its first page, with a single size in stock (so "add" puts it straight
 * in the basket). Never one the admin tests create and delete while other tests run.
 */
export async function stableProduct(request: APIRequestContext): Promise<ShopProduct> {
  const products = await shopProducts(request);
  const pick = products
    .slice(0, 24)
    .find((p) => !p.name.startsWith("Playwright") && p.sizes.length === 1 && p.sizes[0].stock > 5);
  if (!pick) throw new Error("No single-size, in-stock product on the first page of the catalog");
  return pick;
}

/** A word from the product's name that is long enough to search for. */
export function searchWord(product: ShopProduct): string {
  return product.name.split(/\s+/).find((w) => /^[\p{L}'-]{4,}$/u.test(w)) ?? product.name;
}
