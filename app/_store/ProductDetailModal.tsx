"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Heart, Plus, X } from "lucide-react";
import { sizedImage } from "@/lib/images";
import { ProductDetails, ProductGallery } from "@/app/components/ProductDetails";
import { StarRating } from "@/app/components/StarRating";
import { Reviews, useReviews } from "./Reviews";
import type { Account, Product, ProductSize, Translate } from "./types";
import { euro, imageFallback } from "./ui";

type Related = { id: string; name: string; image: string; category: string };

type Props = {
  product: Product;
  account: Account | null;
  liked: boolean;
  onLike: () => void;
  onClose: () => void;
  onAdd: (size: ProductSize) => void;
  onOpenRelated: (id: string) => void;
  t: Translate;
};

export function ProductDetailModal({ product, account, liked, onLike, onClose, onAdd, onOpenRelated, t }: Props) {
  const [sizeId, setSizeId] = useState(product.sizes[0]?.id);
  const size = product.sizes.find((s) => s.id === sizeId) ?? product.sizes[0];
  const [related, setRelated] = useState<Related[]>([]);
  const { reviews, summary, loading, reload } = useReviews(product.id, { average: product.ratingAverage, count: product.ratingCount });

  useEffect(() => {
    fetch(`/api/products/${product.id}/related`)
      .then((res) => res.json())
      .then((data) => setRelated(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [product.id]);

  // Close on Escape, like any dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!size) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="checkout-modal"
        role="dialog"
        aria-modal="true"
        aria-label={product.name}
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "90vh", overflow: "auto", maxWidth: 640 }}
      >
        <button type="button" className="close-modal" onClick={onClose} aria-label={t("Schließen", "Close")}>
          <X />
        </button>

        <ProductGallery images={product.images} alt={product.name} zoomHint={t("Zum Vergrößern klicken", "Click to enlarge")} />

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
          <StarRating value={summary.average} size={16} />
          <span style={{ fontSize: 14, color: "rgba(24,32,27,.7)" }}>
            {summary.count > 0
              ? `${summary.average.toFixed(1)} · ${summary.count} ${t(summary.count === 1 ? "Bewertung" : "Bewertungen", summary.count === 1 ? "review" : "reviews")}`
              : t("Noch keine Bewertungen", "No reviews yet")}
          </span>
        </div>

        <ProductDetails description={product.description} highlights={product.highlights} specs={product.specs} t={t} />
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
            <b>{euro(size.price)}</b>
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
                  <img
                    src={sizedImage(r.image, 200)}
                    alt={r.name}
                    onError={imageFallback}
                    style={{ width: 96, height: 96, objectFit: "contain", borderRadius: 10, marginBottom: 4 }}
                  />
                  <small style={{ display: "block", lineHeight: 1.2 }}>{r.name}</small>
                </button>
              ))}
            </div>
          </div>
        )}

        <Reviews productId={product.id} account={account} reviews={reviews} loading={loading} onSubmitted={reload} t={t} />
      </div>
    </div>
  );
}
