"use client";

import { memo, useState } from "react";
import { Heart, Plus } from "lucide-react";
import { sizedImage } from "@/lib/images";
import { StarRating } from "@/app/components/StarRating";
import { salePercent } from "./catalog-filters";
import type { Product, ProductSize, Translate } from "./types";
import { euro, imageFallback } from "./ui";

type Props = {
  product: Product;
  liked: boolean;
  onLike: (id: string) => void;
  onAdd: (product: Product, size: ProductSize) => void;
  onOpen: (product: Product) => void;
  t: Translate;
};

const linkButton = { background: "none", border: "none", padding: 0, cursor: "pointer" } as const;

/** One product tile in the grid. Memoised: the grid can hold hundreds of these. */
export const ProductCard = memo(function ProductCard({ product, liked, onLike, onAdd, onOpen, t }: Props) {
  const [sizeId, setSizeId] = useState(product.sizes[0]?.id);
  const size = product.sizes.find((s) => s.id === sizeId) ?? product.sizes[0];
  if (!size) return null;
  const open = () => onOpen(product);

  return (
    <article className="product-card">
      <div className="product-image" onClick={open} style={{ cursor: "pointer" }}>
        <img src={sizedImage(product.image, 600)} alt={product.name} onError={imageFallback} loading="lazy" decoding="async" />
        {product.badge && <span className="product-badge">{product.badge}</span>}
        {!product.badge && size.oldPrice && size.oldPrice > size.price && (
          <span className="product-badge sale">−{salePercent(size.price, size.oldPrice)}%</span>
        )}
        {size.stock === 0 && <span className="stock-flag out">{t("Ausverkauft", "Sold out")}</span>}
        {size.stock > 0 && size.stock <= 5 && <span className="stock-flag">{t(`Nur noch ${size.stock}`, `Only ${size.stock} left`)}</span>}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLike(product.id);
          }}
          className={liked ? "heart liked" : "heart"}
          aria-label={liked ? t("Aus Wunschliste entfernen", "Remove from wishlist") : t("Zur Wunschliste hinzufügen", "Add to wishlist")}
          aria-pressed={liked}
        >
          <Heart size={18} fill={liked ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="product-info">
        <span className="product-category">
          {product.category}
          {product.tags?.length ? <span className="product-tags"> · {product.tags.slice(0, 2).join(" · ")}</span> : null}
        </span>
        <h3 onClick={open} style={{ cursor: "pointer" }}>
          {product.name}
        </h3>
        {product.ratingCount > 0 ? (
          <button onClick={open} style={{ ...linkButton, display: "flex", alignItems: "center", gap: 6 }}>
            <StarRating value={product.ratingAverage} />
            <small style={{ color: "rgba(24,32,27,.6)" }}>
              {product.ratingAverage.toFixed(1)} ({product.ratingCount})
            </small>
          </button>
        ) : (
          <button onClick={open} style={linkButton}>
            <small style={{ color: "rgba(24,32,27,.45)" }}>{t("Noch keine Bewertungen", "No reviews yet")}</small>
          </button>
        )}

        {product.sizes.length > 1 && (
          <div className="size-row">
            {product.sizes.map((s) => (
              <button key={s.id} className={s.id === size.id ? "size-pill active" : "size-pill"} onClick={() => setSizeId(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div className="product-bottom">
          <div>
            <b>{euro(size.price)}</b>
            {product.unitNote && <small> {product.unitNote}</small>}
            {size.oldPrice && <del>{euro(size.oldPrice)}</del>}
          </div>
          <button
            onClick={() => onAdd(product, size)}
            className="add-btn"
            disabled={size.stock === 0}
            aria-label={t(`${product.name} hinzufügen`, `Add ${product.name}`)}
          >
            <Plus size={17} />
            <span>{size.stock === 0 ? t("Ausverkauft", "Sold out") : t("Hinzufügen", "Add")}</span>
          </button>
        </div>
      </div>
    </article>
  );
});
