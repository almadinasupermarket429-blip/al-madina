"use client";

import { ArrowRight, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { sizedImage } from "@/lib/images";
import type { StoreSettings } from "@/lib/settings-shared";
import { remainingForFreeDelivery } from "./catalog-filters";
import type { CartItem, Translate } from "./types";
import { euro, imageFallback } from "./ui";

type Props = {
  items: CartItem[];
  count: number;
  subtotal: number;
  settings: StoreSettings;
  onChangeQty: (key: string, delta: number) => void;
  onCheckout: () => void;
  onClose: () => void;
  t: Translate;
};

export function CartDrawer({ items, count, subtotal, settings, onChangeQty, onCheckout, onClose, t }: Props) {
  const belowMinimum = settings.minimumOrder > subtotal;
  const canCheckout = settings.acceptingOrders && !belowMinimum;
  const threshold = settings.freeDeliveryThreshold;
  const progress = threshold > 0 ? Math.min(100, (subtotal / threshold) * 100) : 0;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="cart-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <span className="eyebrow">{t("Ihr Warenkorb", "Your basket")}</span>
            <h3>
              {count} {t("Artikel", "item")}
              {count === 1 ? "" : "s"}
            </h3>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label={t("Schließen", "Close")}>
            <X />
          </button>
        </div>
        {items.length === 0 ? (
          <div className="empty-cart">
            <ShoppingBag size={42} />
            <h3>{t("Ihr Warenkorb wartet.", "Your basket is waiting.")}</h3>
            <p>{t("Fügen Sie einige Favoriten hinzu – sie erscheinen hier.", "Add a few favourites — they'll show up here.")}</p>
            <button className="primary-btn" onClick={onClose}>
              {t("Weiter einkaufen", "Continue shopping")}
            </button>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {items.map((item) => (
                <div className="cart-item" key={item.key}>
                  <img src={sizedImage(item.image, 200)} alt="" onError={imageFallback} />
                  <div>
                    <b>{item.name}</b>
                    <span>
                      {item.sizeLabel} · {euro(item.price)}
                    </span>
                    <div className="qty">
                      <button onClick={() => onChangeQty(item.key, -1)} aria-label={t("Menge verringern", "Decrease quantity")}>
                        <Minus size={13} />
                      </button>
                      <span>{item.qty}</span>
                      <button onClick={() => onChangeQty(item.key, 1)} disabled={item.qty >= item.stock} aria-label={t("Menge erhöhen", "Increase quantity")}>
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="cart-summary">
              {settings.deliveryEnabled && threshold > 0 && (
                <div className="free-delivery" style={{ display: "block" }}>
                  <span>
                    {subtotal >= threshold
                      ? t("🎉 Kostenlose Lieferung freigeschaltet!", "🎉 You've unlocked free delivery!")
                      : t(
                          `Noch ${euro(remainingForFreeDelivery(subtotal, threshold))} bis zur kostenlosen Lieferung`,
                          `${euro(remainingForFreeDelivery(subtotal, threshold))} away from free delivery`
                        )}
                  </span>
                  <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
                    <i style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
              <div>
                <span>{t("Zwischensumme", "Subtotal")}</span>
                <b>{euro(subtotal)}</b>
              </div>
              {belowMinimum ? (
                <small style={{ textAlign: "left", color: "#b3261e" }}>
                  {t(
                    `Mindestbestellwert ${euro(settings.minimumOrder)} — noch ${euro(settings.minimumOrder - subtotal)}.`,
                    `Minimum order ${euro(settings.minimumOrder)} — add ${euro(settings.minimumOrder - subtotal)} more.`
                  )}
                </small>
              ) : (
                <small style={{ textAlign: "left" }}>{t("Lieferkosten & Abholoption werden an der Kasse gewählt.", "Delivery fee / pickup option is chosen at checkout.")}</small>
              )}
              {!settings.acceptingOrders && <small style={{ textAlign: "left", color: "#b3261e" }}>{settings.closedMessage}</small>}
              <button
                className="primary-btn full"
                onClick={onCheckout}
                disabled={!canCheckout}
                style={!canCheckout ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
              >
                {t("Zur Kasse", "Checkout")} <ArrowRight size={17} />
              </button>
              <small>{t("Zahlung bar bei Lieferung oder Abholung", "Cash payment on delivery or pickup")}</small>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
