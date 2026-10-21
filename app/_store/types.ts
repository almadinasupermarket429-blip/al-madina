// Shared storefront types and the mapping from API data to what the UI renders.

export type Translate = (de: string, en: string) => string;
export type Language = "de" | "en";

export type ProductSize = { id: string; label: string; price: number; oldPrice: number | null; stock: number };
type ProductSpec = { label: string; labelEn?: string | null; value: string; valueEn?: string | null };

/** Shape returned by /api/products: German in the plain fields, English in *En (may be empty). */
export type RawProduct = {
  id: string;
  name: string;
  nameEn: string | null;
  category: string;
  categoryEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  brand: string | null;
  highlights: string[] | null;
  highlightsEn: string[] | null;
  specs: ProductSpec[] | null;
  gallery: string[] | null;
  image: string;
  badge: string | null;
  unitNote: string | null;
  tags: string[];
  slug: string;
  sizes: ProductSize[];
  ratingAverage: number;
  ratingCount: number;
};

/** A product with its text already in the visitor's language. */
export type Product = {
  id: string;
  name: string;
  /** Stable category id for filtering (the German name), unchanged by the language toggle. */
  categoryKey: string;
  category: string;
  description: string | null;
  brand: string | null;
  highlights: string[];
  specs: { label: string; value: string }[];
  images: string[];
  /** Both languages, so search finds a product whichever language the visitor types in. */
  searchText: string;
  image: string;
  badge: string | null;
  unitNote: string | null;
  tags: string[];
  slug: string;
  sizes: ProductSize[];
  ratingAverage: number;
  ratingCount: number;
};

export function localizeProduct(p: RawProduct, language: Language): Product {
  const en = language === "en";
  const highlights = (en && p.highlightsEn?.length ? p.highlightsEn : p.highlights) ?? [];
  return {
    id: p.id,
    name: (en && p.nameEn) || p.name,
    categoryKey: p.category ?? "",
    category: (en && p.categoryEn) || p.category,
    description: (en && p.descriptionEn) || p.description,
    brand: p.brand,
    highlights,
    specs: (p.specs ?? []).map((s) => ({ label: (en && s.labelEn) || s.label, value: (en && s.valueEn) || s.value })),
    images: [p.image, ...(p.gallery ?? [])].filter(Boolean),
    searchText: [p.name, p.nameEn, p.brand, p.category, p.categoryEn, p.description, p.descriptionEn, ...(p.tags ?? [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
    image: p.image,
    badge: p.badge,
    unitNote: p.unitNote,
    tags: p.tags,
    slug: p.slug,
    sizes: p.sizes,
    ratingAverage: p.ratingAverage,
    ratingCount: p.ratingCount,
  };
}

export type SortOption = "relevance" | "price-asc" | "price-desc" | "rating";
export type Account = { id: string; name: string; email: string; phone: string | null; role?: "OWNER" | "STAFF" | null };
export type Slot = { id: string; date: string; start: string; end: string; remaining: number };

export type CartItem = {
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

export type ServerCartItem = {
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

export function mapServerCart(items: ServerCartItem[]): CartItem[] {
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

export type ReviewData = {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  createdAt: string;
  authorName: string;
};
