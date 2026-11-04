// app/products/[slug]/page.tsx
import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { STORE } from "@/lib/store-info";
import type { Variant } from "@/app/components/VariantSelector";
import { absoluteImage } from "@/lib/images";
import { FOOD_INFO_COLUMNS } from "@/lib/catalog-admin";
import type { FoodFactsData } from "@/lib/food-info";
import { ProductPageBody } from "./ProductPageBody";

type ProductRow = FoodFactsData & {
  id: string;
  name: string;
  name_en: string | null;
  slug: string;
  description: string | null;
  description_en: string | null;
  image_url: string | null;
  unit_note: string | null;
  category_name: string | null;
  category_name_en: string | null;
  brand: string | null;
  highlights: string[] | null;
  highlights_en: string[] | null;
  specs: { label: string; labelEn?: string | null; value: string; valueEn?: string | null }[] | null;
  gallery: string[] | null;
};

type VariantRow = {
  id: string;
  sku: string;
  size_label: string;
  price: string;
  compare_at_price: string | null;
  stock_quantity: number;
  size_value: string | null;
  size_unit: string | null;
  deposit: string | null;
};

type ReviewStatsRow = { average: string | null; count: string };

// cache(): generateMetadata and the page both need the product — one query per request.
const getProduct = cache(async function getProduct(slug: string): Promise<ProductRow | null> {
  const rows = await prisma.$queryRaw<ProductRow[]>`
    select p.id, p.name, p.name_en, p.slug, p.description, p.description_en, p.image_url, p.unit_note,
           c.name as category_name, c.name_en as category_name_en, p.brand, p.highlights, p.highlights_en,
           p.specs, p.gallery, ${FOOD_INFO_COLUMNS}
    from products p
    left join categories c on c.id = p.category_id
    where p.slug = ${slug} and p.is_active = true
    limit 1
  `;
  return rows[0] ?? null;
});

async function getVariants(productId: string): Promise<Variant[]> {
  const rows = await prisma.$queryRaw<VariantRow[]>`
    select id, sku, size_label, price, compare_at_price, stock_quantity,
           size_value, size_unit::text as size_unit, deposit
    from product_variants
    where product_id = ${productId}::uuid and is_active = true
    order by sort_order asc, size_value asc nulls last
  `;

  return rows.map((v) => ({
    ...v,
    price: Number(v.price),
    compare_at_price: v.compare_at_price ? Number(v.compare_at_price) : null,
    size_value: v.size_value != null ? Number(v.size_value) : null,
    deposit: v.deposit != null ? Number(v.deposit) : 0,
  }));
}

async function getReviewStats(productId: string) {
  const rows = await prisma.$queryRaw<ReviewStatsRow[]>`
    select avg(rating) as average, count(*) as count from reviews where product_id = ${productId}::uuid
  `;
  return { average: Number(rows[0]?.average ?? 0), count: Number(rows[0]?.count ?? 0) };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Produkt nicht gefunden" };
  const description =
    product.description?.slice(0, 160) ||
    `${product.name} bei ${STORE.name} in ${STORE.city} — online bestellen, bar bei Lieferung oder Abholung bezahlen.`;
  return {
    title: product.name,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: `${product.name} | ${STORE.name}`,
      description,
      images: product.image_url ? [{ url: absoluteImage(product.image_url, 1200) }] : undefined,
      type: "website",
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const [variants, reviewStats] = await Promise.all([getVariants(product.id), getReviewStats(product.id)]);
  if (variants.length === 0) notFound();

  const inStock = variants.some((v) => v.stock_quantity > 0);
  const prices = variants.map((v) => v.price);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    image: product.image_url ? absoluteImage(product.image_url, 1200) : undefined,
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    category: product.category_name ?? undefined,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "EUR",
      lowPrice: Math.min(...prices).toFixed(2),
      highPrice: Math.max(...prices).toFixed(2),
      offerCount: variants.length,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@type": "GroceryStore", name: STORE.name },
    },
    ...(reviewStats.count > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: reviewStats.average.toFixed(1), reviewCount: reviewStats.count } }
      : {}),
  };

  return (
    <main id="main" tabIndex={-1} className="min-h-screen bg-[#f8f7f3] text-[#18201b] flex flex-col items-center py-12 px-4 md:px-8">
      <script
        type="application/ld+json"
        // JSON.stringify can't produce "</script>" on its own, but product text is admin-entered — escape "<" anyway.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ProductPageBody
        product={{
          name: product.name,
          nameEn: product.name_en,
          description: product.description,
          descriptionEn: product.description_en,
          category: product.category_name,
          categoryEn: product.category_name_en,
          unitNote: product.unit_note,
          images: product.image_url ? [product.image_url, ...(product.gallery ?? [])] : [],
          highlights: product.highlights ?? [],
          highlightsEn: product.highlights_en ?? [],
          specs: product.specs ?? [],
          food: {
            ingredients: product.ingredients,
            ingredientsEn: product.ingredientsEn,
            allergens: product.allergens,
            allergensConfirmed: product.allergensConfirmed,
            traces: product.traces,
            nutrition: product.nutrition,
            nutritionNotRequired: product.nutritionNotRequired,
            storage: product.storage,
            storageEn: product.storageEn,
            manufacturer: product.manufacturer,
            origin: product.origin,
          },
        }}
        variants={variants}
        reviews={reviewStats}
      />
    </main>
  );
}
