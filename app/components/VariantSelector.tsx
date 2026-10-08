// app/components/VariantSelector.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";

export type Variant = {
  id: string;
  sku: string;
  size_label: string;
  price: number;
  compare_at_price: number | null;
  stock_quantity: number;
};

export function VariantSelector({ variants }: { variants: Variant[] }) {
  const { t } = useLanguage();
  const [selectedId, setSelectedId] = useState(variants[0]?.id);
  const [status, setStatus] = useState<"idle" | "adding" | "added" | "error">("idle");

  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];
  const outOfStock = selected.stock_quantity <= 0;

  async function handleAddToCart() {
    setStatus("adding");
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: selected.id, quantity: 1 }),
      });
      if (!res.ok) throw new Error("request failed");
      setStatus("added");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      {variants.length > 1 && (
        <div className="size-row" style={{ margin: "10px 0" }}>
          {variants.map((v) => {
            const isOut = v.stock_quantity <= 0;
            return (
              <button
                key={v.id}
                disabled={isOut}
                className={v.id === selected.id ? "size-pill active" : "size-pill"}
                onClick={() => setSelectedId(v.id)}
                style={isOut ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
              >
                {v.size_label}
              </button>
            );
          })}
        </div>
      )}

      <div className="checkout-box" style={{ marginBottom: 20 }}>
        <div>
          <b>{formatCurrency(selected.price)}</b>
          {selected.compare_at_price && (
            <del style={{ marginLeft: 8, color: "#a2a6a3", fontSize: 12 }}>{formatCurrency(selected.compare_at_price)}</del>
          )}
        </div>
        <button className="primary-btn" onClick={handleAddToCart} disabled={outOfStock || status === "adding"}>
          <Plus size={17} />
          {/* Own <span> so browser translation can't break React updating this label. */}
          <span>
            {outOfStock
              ? t("Ausverkauft", "Out of stock")
              : status === "added"
                ? t("Hinzugefügt", "Added")
                : status === "adding"
                  ? t("Wird hinzugefügt…", "Adding…")
                  : t("In den Warenkorb", "Add to basket")}
          </span>
        </button>
      </div>

      {status === "added" && (
        <p style={{ fontSize: 14, marginTop: -10, marginBottom: 16 }}>
          <Link href="/cart" style={{ color: "#1f6b46", fontWeight: 700 }}>
            {t("Zum Warenkorb →", "View basket →")}
          </Link>
        </p>
      )}
      {status === "error" && (
        <p style={{ color: "#b3261e", fontSize: 13, marginTop: -10, marginBottom: 16 }}>
          {t("Konnte nicht zum Warenkorb hinzugefügt werden — bitte erneut versuchen.", "Couldn't add that to your cart — try again.")}
        </p>
      )}
      {selected.stock_quantity > 0 && selected.stock_quantity <= 5 && (
        <p style={{ color: "#c79a3a", fontSize: 13, fontWeight: 700, marginTop: -10 }}>
          {t(`Nur noch ${selected.stock_quantity} verfügbar`, `Only ${selected.stock_quantity} left`)}
        </p>
      )}
    </>
  );
}
