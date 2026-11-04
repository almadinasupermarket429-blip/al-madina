"use client";
// The visible part of /products/[slug], in the visitor's language (the page itself is rendered on the server).

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import type { FoodFactsData } from "@/lib/food-info";
import { StarRating } from "@/app/components/StarRating";
import { VariantSelector, type Variant } from "@/app/components/VariantSelector";
import { FoodFacts, ProductDetails, ProductGallery } from "@/app/components/ProductDetails";

export type ProductPageData = {
  name: string;
  nameEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  category: string | null;
  categoryEn: string | null;
  unitNote: string | null;
  images: string[];
  highlights: string[];
  highlightsEn: string[];
  specs: { label: string; labelEn?: string | null; value: string; valueEn?: string | null }[];
  food: FoodFactsData;
};

export function ProductPageBody({
  product,
  variants,
  reviews,
}: {
  product: ProductPageData;
  variants: Variant[];
  reviews: { average: number; count: number };
}) {
  const { t, language } = useLanguage();
  const en = language === "en";
  const name = (en && product.nameEn) || product.name;
  const category = (en && product.categoryEn) || product.category;
  const highlights = en && product.highlightsEn.length ? product.highlightsEn : product.highlights;
  const specs = product.specs.map((s) => ({ label: (en && s.labelEn) || s.label, value: (en && s.valueEn) || s.value }));
  const reviewWord = reviews.count === 1 ? t("Bewertung", "review") : t("Bewertungen", "reviews");

  return (
    <div className="w-full max-w-xl bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-black/5">
      <Link href="/" className="text-btn" style={{ display: "inline-flex", marginBottom: 24 }}>
        <ArrowLeft size={16} /> {t("Zurück zum Shop", "Back to the shop")}
      </Link>

      {product.images.length > 0 && (
        <ProductGallery images={product.images} alt={name} zoomHint={t("Zum Vergrößern klicken", "Click to enlarge")} />
      )}

      {category && <p style={{ fontSize: 13, color: "#5f6762", margin: 0 }}>{category}</p>}
      <h1 style={{ fontSize: 30, margin: "8px 0 0" }}>{name}</h1>

      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0 14px" }}>
        <StarRating value={reviews.average} size={16} />
        <span style={{ fontSize: 14, color: "rgba(24,32,27,.7)" }}>
          {reviews.count > 0
            ? `${reviews.average.toLocaleString(en ? "en-GB" : "de-DE", { maximumFractionDigits: 1 })} (${reviews.count} ${reviewWord})`
            : t("Noch keine Bewertungen", "No reviews yet")}
        </span>
      </div>

      {product.unitNote && <p style={{ color: "#5f6762", fontSize: 13, marginBottom: 6 }}>{product.unitNote}</p>}
      <ProductDetails description={(en && product.descriptionEn) || product.description} highlights={highlights} specs={specs} t={t} />
      <FoodFacts food={product.food} language={language} t={t} />

      <VariantSelector variants={variants} />
    </div>
  );
}
