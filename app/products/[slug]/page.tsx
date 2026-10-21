// app/products/[slug]/page.tsx
import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { STORE } from "@/lib/store-info";
import { StarRating } from "@/app/components/StarRating";
import { VariantSelector, type Variant } from "@/app/components/VariantSelector";
import { ProductGallery, ProductDetails } from "@/app/components/ProductDetails";
import { absoluteImage } from "@/lib/images";

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  unit_note: string | null;
  category_name: string | null;
  brand: string | null;
  highlights: string[];
  specs: { label: string; value: string }[];
  gallery: string[];
};

type VariantRow = {
  id: string;
  sku: string;
  size_label: string;
  price: string;
  compare_at_price: string | null;
  stock_quantity: number;
};

type ReviewStatsRow = { average: string | null; count: string };

// cache(): generateMetadata and the page both need the product — one query per request.
const getProduct = cache(async function getProduct(slug: string): Promise<ProductRow | null> {
  const rows = await prisma.$queryRaw<ProductRow[]>`
    select p.id, p.name, p.slug, p.description, p.image_url, p.unit_note,
           c.name as category_name, p.brand, p.highlights, p.specs, p.gallery
    from products p
    left join categories c on c.id = p.category_id
    where p.slug = ${slug} and p.is_active = true
    limit 1
  `;
  return rows[0] ?? null;
});

async function getVariants(productId: string): Promise<Variant[]> {
  const rows = await prisma.$queryRaw<VariantRow[]>`
    select id, sku, size_label, price, compare_at_price, stock_quantity
    from product_variants
    where product_id = ${productId}::uuid and is_active = true
    order by sort_order asc, size_value asc nulls last
  `;

  return rows.map((v) => ({
    ...v,
    price: Number(v.price),
    compare_at_price: v.compare_at_price ? Number(v.compare_at_price) : null,
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
    <main className="min-h-screen bg-[#f8f7f3] text-[#18201b] flex flex-col items-center py-12 px-4 md:px-8">
      <script
        type="application/ld+json"
        // JSON.stringify can't produce "</script>" on its own, but product text is admin-entered — escape "<" anyway.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="w-full max-w-xl bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-black/5">
        <Link href="/" className="text-btn" style={{ display: "inline-flex", marginBottom: 24 }}>
          <ArrowLeft size={16} /> Zurück zum Shop
        </Link>

        {product.image_url && (
          <ProductGallery images={[product.image_url, ...(product.gallery ?? [])]} alt={product.name} zoomHint="Zum Vergrößern klicken" />
        )}

        {product.category_name && <span className="eyebrow">{product.category_name}</span>}
        <h1 style={{ fontSize: 30, margin: "8px 0 0" }}>{product.name}</h1>

        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0 14px" }}>
          <StarRating value={reviewStats.average} size={16} />
          <span style={{ fontSize: 14, color: "rgba(24,32,27,.7)" }}>
            {reviewStats.count > 0
              ? `${reviewStats.average.toFixed(1)} · ${reviewStats.count} ${reviewStats.count === 1 ? "Bewertung" : "Bewertungen"}`
              : "Noch keine Bewertungen"}
          </span>
        </div>

        {product.unit_note && <p style={{ color: "#6d766f", fontSize: 13, marginBottom: 6 }}>{product.unit_note}</p>}
        <ProductDetails
          description={product.description}
          highlights={product.highlights ?? []}
          specs={(product.specs ?? []).map((s) => ({ label: s.label, value: s.value }))}
          t={(de) => de}
        />

        <VariantSelector variants={variants} />
      </div>
    </main>
  );
}
