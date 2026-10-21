import { describe, expect, it } from "vitest";
import { ALL, OFFERS, categoryKeys, filterAndSort, remainingForFreeDelivery, salePercent, topRated } from "@/app/_store/catalog-filters";
import { localizeProduct, mapServerCart, type Product, type RawProduct } from "@/app/_store/types";

function raw(overrides: Partial<RawProduct> = {}): RawProduct {
  return {
    id: "p1",
    name: "Rote Linsen",
    nameEn: "Red Lentils",
    category: "Hülsenfrüchte",
    categoryEn: "Pulses & Beans",
    description: "Linsen für Suppen.",
    descriptionEn: "Lentils for soups.",
    brand: "Garrido",
    highlights: ["Reich an Eiweiß"],
    highlightsEn: ["A source of protein"],
    specs: [{ label: "Marke", labelEn: "Brand", value: "Garrido", valueEn: "Garrido" }],
    gallery: [],
    image: "img.webp",
    badge: null,
    unitNote: null,
    tags: [],
    slug: "garrido-red-lentils",
    sizes: [{ id: "s1", label: "1 kg", price: 2.49, oldPrice: null, stock: 10 }],
    ratingAverage: 0,
    ratingCount: 0,
    ...overrides,
  };
}

const product = (o: Partial<RawProduct> = {}): Product => localizeProduct(raw(o), "de");

describe("localizeProduct", () => {
  it("uses German by default and English when the visitor switches", () => {
    expect(localizeProduct(raw(), "de")).toMatchObject({ name: "Rote Linsen", category: "Hülsenfrüchte", highlights: ["Reich an Eiweiß"] });
    expect(localizeProduct(raw(), "en")).toMatchObject({
      name: "Red Lentils",
      category: "Pulses & Beans",
      description: "Lentils for soups.",
      highlights: ["A source of protein"],
      specs: [{ label: "Brand", value: "Garrido" }],
    });
  });

  it("falls back to German when an English text is missing", () => {
    const p = localizeProduct(raw({ nameEn: null, descriptionEn: null, highlightsEn: [] }), "en");
    expect(p.name).toBe("Rote Linsen");
    expect(p.description).toBe("Linsen für Suppen.");
    expect(p.highlights).toEqual(["Reich an Eiweiß"]);
  });

  it("keeps the German category as a stable filter key in both languages", () => {
    expect(localizeProduct(raw(), "en").categoryKey).toBe("Hülsenfrüchte");
  });

  it("makes products searchable in both languages", () => {
    const p = localizeProduct(raw(), "de");
    expect(p.searchText).toContain("red lentils");
    expect(p.searchText).toContain("rote linsen");
    expect(p.searchText).toContain("garrido");
  });
});

describe("catalog filters", () => {
  const items = [
    product({ id: "a", name: "Basmati", category: "Reis", sizes: [{ id: "a1", label: "1 kg", price: 3, oldPrice: null, stock: 1 }] }),
    product({ id: "b", name: "Bulgur", category: "Getreide", tags: ["Vegan"], sizes: [{ id: "b1", label: "1 kg", price: 1, oldPrice: 2, stock: 1 }] }),
    product({ id: "c", name: "Couscous", category: "Getreide", ratingAverage: 4.5, ratingCount: 2, sizes: [{ id: "c1", label: "1 kg", price: 2, oldPrice: null, stock: 1 }] }),
  ];
  const base = { category: ALL, query: "", tag: null, sort: "relevance" as const };

  it("lists 'All', then 'Offers' when something is discounted, then categories in catalog order", () => {
    expect(categoryKeys(items)).toEqual([ALL, OFFERS, "Reis", "Getreide"]);
    expect(categoryKeys(items.slice(0, 1))).toEqual([ALL, "Reis"]);
  });

  it("filters by category, offers, tag and search text", () => {
    expect(filterAndSort(items, { ...base, category: "Getreide" }).map((p) => p.id)).toEqual(["b", "c"]);
    expect(filterAndSort(items, { ...base, category: OFFERS }).map((p) => p.id)).toEqual(["b"]);
    expect(filterAndSort(items, { ...base, tag: "Vegan" }).map((p) => p.id)).toEqual(["b"]);
    expect(filterAndSort(items, { ...base, query: "  BASMATI " }).map((p) => p.id)).toEqual(["a"]);
  });

  it("sorts by price and rating without changing the input", () => {
    expect(filterAndSort(items, { ...base, sort: "price-asc" }).map((p) => p.id)).toEqual(["b", "c", "a"]);
    expect(filterAndSort(items, { ...base, sort: "price-desc" }).map((p) => p.id)).toEqual(["a", "c", "b"]);
    expect(filterAndSort(items, { ...base, sort: "rating" })[0].id).toBe("c");
    expect(items.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("top rated only includes rated products", () => {
    expect(topRated(items).map((p) => p.id)).toEqual(["c"]);
  });
});

describe("money helpers", () => {
  it("computes what's missing for free delivery, never negative, rounded to cents", () => {
    expect(remainingForFreeDelivery(30.1, 40)).toBe(9.9);
    expect(remainingForFreeDelivery(55, 40)).toBe(0);
  });

  it("computes the sale percentage shown on the badge", () => {
    expect(salePercent(1, 2)).toBe(50);
    expect(salePercent(2.49, 2.99)).toBe(17);
  });
});

describe("mapServerCart", () => {
  it("maps the API cart into basket items", () => {
    expect(
      mapServerCart([
        { id: "ci", variant_id: "v", quantity: 2, size_label: "1 kg", price: 2.49, stock_quantity: 5, product_id: "p", product_name: "Linsen", image_url: null },
      ])
    ).toEqual([{ key: "ci", productId: "p", sizeId: "v", name: "Linsen", sizeLabel: "1 kg", price: 2.49, image: "", qty: 2, stock: 5 }]);
  });
});
