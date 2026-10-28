import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { slugify } from "./slug";
import { ALLERGEN_KEYS, NUTRIENTS, SIZE_UNITS, type Nutrition, type SizeUnit } from "./food-info";

/** Finds a unique products.slug for `name`, appending -2, -3, … on collision. */
export async function uniqueProductSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let n = 2;
  for (;;) {
    const rows = excludeId
      ? await prisma.$queryRaw<{ id: string }[]>`select id from products where slug = ${candidate} and id != ${excludeId}::uuid limit 1`
      : await prisma.$queryRaw<{ id: string }[]>`select id from products where slug = ${candidate} limit 1`;
    if (!rows[0]) return candidate;
    candidate = `${base}-${n++}`;
  }
}

/** Finds a category by name (case-insensitive), creating one if it doesn't exist yet. */
export async function resolveCategoryId(categoryName: string): Promise<string | null> {
  const trimmed = categoryName?.trim();
  if (!trimmed) return null;

  const existing = await prisma.$queryRaw<{ id: string }[]>`
    select id from categories where lower(name) = lower(${trimmed}) limit 1
  `;
  if (existing[0]) return existing[0].id;

  const base = slugify(trimmed);
  let slug = base;
  let n = 2;
  for (;;) {
    const clash = await prisma.$queryRaw<{ id: string }[]>`select id from categories where slug = ${slug} limit 1`;
    if (!clash[0]) break;
    slug = `${base}-${n++}`;
  }

  const created = await prisma.$queryRaw<{ id: string }[]>`
    insert into categories (name, slug) values (${trimmed}, ${slug}) returning id
  `;
  return created[0].id;
}

/** product_variants.sku is unique but not customer-facing — random suffix keeps this collision-free. */
function generateSku(productSlug: string): string {
  return `${productSlug.toUpperCase().slice(0, 24)}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

type AdminSize = {
  id?: string;
  label: string;
  price: number;
  oldPrice?: number;
  stock?: number;
  sizeValue?: number | string | null;
  sizeUnit?: string | null;
  deposit?: number | string | null;
};

/** Net quantity + deposit from the admin form, cleaned up. Invalid values become null / 0. */
function sizeExtras(s: AdminSize): { sizeValue: number | null; sizeUnit: SizeUnit | null; deposit: number } {
  const value = s.sizeValue === "" || s.sizeValue == null ? NaN : Number(String(s.sizeValue).replace(",", "."));
  const unit = SIZE_UNITS.includes(s.sizeUnit as SizeUnit) ? (s.sizeUnit as SizeUnit) : null;
  const ok = Number.isFinite(value) && value > 0 && value < 1_000_000 && unit != null;
  const deposit = Number(String(s.deposit ?? "").replace(",", "."));
  return {
    sizeValue: ok ? Math.round(value * 1000) / 1000 : null,
    sizeUnit: ok ? unit : null,
    deposit: Number.isFinite(deposit) && deposit > 0 && deposit < 100 ? Math.round(deposit * 100) / 100 : 0,
  };
}
type AdminProductView = {
  id: string;
  name: string;
  nameEn: string | null;
  descriptionEn: string | null;
  brand: string | null;
  highlights: string[];
  highlightsEn: string[];
  specs: ProductSpec[];
  gallery: string[];
  category: string | null;
  description: string | null;
  image: string | null;
  badge: string | null;
  unitNote: string | null;
  tags: string[];
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  sizes: {
    id: string;
    productId: string;
    label: string;
    price: number;
    oldPrice: number | null;
    stock: number;
    sortOrder: number;
    sizeValue: number | null;
    sizeUnit: string | null;
    deposit: number;
  }[];
} & FoodInfoView;

type FoodInfoView = {
  ingredients: string | null;
  ingredientsEn: string | null;
  ingredientsNotRequired: boolean;
  allergens: string[];
  allergensConfirmed: boolean;
  traces: string | null;
  nutrition: Nutrition | null;
  nutritionNotRequired: boolean;
  storage: string | null;
  storageEn: string | null;
  manufacturer: string | null;
  origin: string | null;
};

/** The food-information columns, aliased to FoodInfoView. The products table is aliased `p`. */
export const FOOD_INFO_COLUMNS = Prisma.sql`
  p.ingredients, p.ingredients_en as "ingredientsEn", p.ingredients_not_required as "ingredientsNotRequired",
  p.allergens, p.allergens_confirmed as "allergensConfirmed", p.traces, p.nutrition,
  p.nutrition_not_required as "nutritionNotRequired", p.storage, p.storage_en as "storageEn",
  p.manufacturer, p.origin
`;

/** Shapes a single product + its active variants the same way GET /api/products does, for create/update responses. */
export async function getAdminProductView(id: string): Promise<AdminProductView | null> {
  const rows = await prisma.$queryRaw<Omit<AdminProductView, "sizes">[]>`
    select
      p.id, p.name, c.name as category, p.description, p.image_url as image,
      p.name_en as "nameEn", p.description_en as "descriptionEn", p.brand, p.highlights,
      p.highlights_en as "highlightsEn", p.specs, p.gallery,
      p.badge, p.unit_note as "unitNote", p.tags, p.is_active as active, p.sort_order as "sortOrder",
      p.created_at as "createdAt", p.updated_at as "updatedAt", ${FOOD_INFO_COLUMNS}
    from products p
    left join categories c on c.id = p.category_id
    where p.id = ${id}::uuid
  `;
  const product = rows[0];
  if (!product) return null;

  const sizes = await prisma.$queryRaw<AdminProductView["sizes"]>`
    select id, product_id as "productId", size_label as label, price, compare_at_price as "oldPrice",
           stock_quantity as stock, sort_order as "sortOrder",
           size_value as "sizeValue", size_unit::text as "sizeUnit", deposit
    from product_variants
    where product_id = ${id}::uuid and is_active = true
    order by sort_order asc
  `;

  return {
    ...product,
    sizes: sizes.map((s) => ({
      ...s,
      price: Number(s.price),
      oldPrice: s.oldPrice != null ? Number(s.oldPrice) : null,
      sizeValue: s.sizeValue != null ? Number(s.sizeValue) : null,
      deposit: Number(s.deposit ?? 0),
    })),
  };
}

/**
 * Syncs a product's variants with the admin form: sizes that carry an existing
 * id are updated in place, new ones are inserted, and ones dropped from the
 * form are deactivated (or deleted if nothing references them). Updating in
 * place matters — deleting a variant cascades out of every customer's cart
 * and nulls order_items.variant_id, which breaks "Reorder" on past orders.
 */
export async function replaceVariants(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  productId: string,
  productSlug: string,
  sizes: AdminSize[]
) {
  const existing = await tx.$queryRaw<{ id: string }[]>`select id from product_variants where product_id = ${productId}::uuid`;
  const existingIds = new Set(existing.map((r) => r.id));
  const keptIds = new Set<string>();

  for (let i = 0; i < sizes.length; i++) {
    const s = sizes[i];
    const oldPrice = s.oldPrice ? Number(s.oldPrice) : null;
    const x = sizeExtras(s);
    if (s.id && existingIds.has(s.id)) {
      keptIds.add(s.id);
      await tx.$executeRaw`
        update product_variants set size_label = ${s.label}, price = ${Number(s.price)}, compare_at_price = ${oldPrice},
          stock_quantity = coalesce(${s.stock ?? null}::int, stock_quantity), sort_order = ${i}, is_active = true,
          size_value = ${x.sizeValue}, size_unit = ${x.sizeUnit}::variant_size_unit, deposit = ${x.deposit}
        where id = ${s.id}::uuid
      `;
    } else {
      await tx.$executeRaw`
        insert into product_variants (product_id, sku, size_label, price, compare_at_price, stock_quantity, sort_order, size_value, size_unit, deposit)
        values (${productId}::uuid, ${generateSku(productSlug)}, ${s.label}, ${Number(s.price)}, ${oldPrice}, ${s.stock ?? 999}, ${i},
                ${x.sizeValue}, ${x.sizeUnit}::variant_size_unit, ${x.deposit})
      `;
    }
  }

  const removed = [...existingIds].filter((id) => !keptIds.has(id));
  if (removed.length > 0) {
    await tx.$executeRaw`delete from cart_items where variant_id = any(${removed}::uuid[])`;
    await tx.$executeRaw`
      update product_variants set is_active = false
      where id = any(${removed}::uuid[]) and exists (select 1 from order_items oi where oi.variant_id = product_variants.id)
    `;
    await tx.$executeRaw`
      delete from product_variants
      where id = any(${removed}::uuid[]) and not exists (select 1 from order_items oi where oi.variant_id = product_variants.id)
    `;
  }
}

type ProductSpec = { label: string; labelEn?: string; value: string; valueEn?: string };

/** The bilingual / detail fields of a product, cleaned up from an admin form submission. */
export type ProductContent = {
  nameEn: string | null;
  descriptionEn: string | null;
  brand: string | null;
  highlights: string[];
  highlightsEn: string[];
  specs: ProductSpec[];
  gallery: string[];
} & FoodInfoView;

const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const lines = (v: unknown, maxItems: number, maxLen: number): string[] => {
  const raw = Array.isArray(v) ? v : typeof v === "string" ? v.split(/\r?\n/) : [];
  return raw.map((x) => String(x).trim().slice(0, maxLen)).filter(Boolean).slice(0, maxItems);
};

export function parseProductContent(body: Record<string, unknown>): ProductContent {
  const specs = (Array.isArray(body.specs) ? body.specs : [])
    .map((s) => {
      const r = (s ?? {}) as Record<string, unknown>;
      return {
        label: text(r.label, 60) ?? "",
        labelEn: text(r.labelEn, 60) ?? undefined,
        value: text(r.value, 200) ?? "",
        valueEn: text(r.valueEn, 200) ?? undefined,
      };
    })
    .filter((s) => s.label && s.value)
    .slice(0, 20);
  const gallery = lines(body.gallery, 8, 500).filter((u) => /^https:\/\//.test(u));
  return {
    nameEn: text(body.nameEn, 200),
    descriptionEn: text(body.descriptionEn, 4000),
    brand: text(body.brand, 120),
    highlights: lines(body.highlights, 10, 200),
    highlightsEn: lines(body.highlightsEn, 10, 200),
    specs,
    gallery,
    ...parseFoodInfo(body),
  };
}

/** The mandatory food information from an admin form, cleaned up. */
function parseFoodInfo(body: Record<string, unknown>): FoodInfoView {
  const allergens = (Array.isArray(body.allergens) ? body.allergens : [])
    .map((a) => String(a).trim())
    .filter((a, i, all) => ALLERGEN_KEYS.includes(a) && all.indexOf(a) === i);
  const rawNutrition = (body.nutrition && typeof body.nutrition === "object" ? body.nutrition : {}) as Record<string, unknown>;
  const nutrition: Nutrition = {};
  for (const n of NUTRIENTS) {
    const raw = rawNutrition[n.key];
    if (raw === "" || raw == null) continue;
    const v = Number(String(raw).replace(",", "."));
    if (Number.isFinite(v) && v >= 0 && v < 10_000) nutrition[n.key] = Math.round(v * 100) / 100;
  }
  return {
    ingredients: text(body.ingredients, 4000),
    ingredientsEn: text(body.ingredientsEn, 4000),
    ingredientsNotRequired: body.ingredientsNotRequired === true,
    allergens,
    allergensConfirmed: body.allergensConfirmed === true,
    traces: text(body.traces, 500),
    nutrition: Object.keys(nutrition).length ? nutrition : null,
    nutritionNotRequired: body.nutritionNotRequired === true,
    storage: text(body.storage, 500),
    storageEn: text(body.storageEn, 500),
    manufacturer: text(body.manufacturer, 500),
    origin: text(body.origin, 200),
  };
}

/** Normalises free-form tag input ("Halal, vegan ,Bio") into a clean, de-duplicated list. */
export function parseTags(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : typeof input === "string" ? input.split(",") : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw) {
    const tag = String(t).trim().slice(0, 30);
    if (tag && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      out.push(tag);
    }
  }
  return out.slice(0, 12);
}

type CategoryRow = { id: string; name: string; slug: string; imageUrl: string | null; sortOrder: number; isActive: boolean; productCount: bigint };

export async function listCategories() {
  const rows = await prisma.$queryRaw<CategoryRow[]>`
    select c.id, c.name, c.slug, c.image_url as "imageUrl", c.sort_order as "sortOrder", c.is_active as "isActive",
           (select count(*) from products p where p.category_id = c.id) as "productCount"
    from categories c
    order by c.sort_order asc, c.name asc
  `;
  return rows.map((r) => ({ ...r, productCount: Number(r.productCount) }));
}
