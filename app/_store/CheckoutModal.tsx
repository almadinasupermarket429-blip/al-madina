"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, Check, Repeat, Store, Ticket, Truck, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { deliveryFeeFor, type StoreSettings } from "@/lib/settings-shared";
import { STORE } from "@/lib/store-info";
import type { Account, CartItem, Slot, Translate } from "./types";
import { euro, slotLabel } from "./ui";

type Props = {
  cart: CartItem[];
  subtotal: number;
  account: Account | null;
  settings: StoreSettings;
  slots: Slot[];
  onClose: () => void;
  onSuccess: () => void;
  t: Translate;
};

type Coupon = { code: string; discount: number; freeDelivery: boolean; description: string | null };
type SavedAddress = { id: string; label: string; address: string; isDefault: boolean };
type Placed = { orderNumber: string; total: number; slot: Slot | null; fulfillment: string };

const row = { display: "flex", justifyContent: "space-between" } as const;

export function CheckoutModal({ cart, subtotal, account, settings, slots, onClose, onSuccess, t }: Props) {
  const { language } = useLanguage();
  const [fulfillment, setFulfillment] = useState<"DELIVERY" | "PICKUP">(settings.deliveryEnabled ? "DELIVERY" : "PICKUP");
  const [slotId, setSlotId] = useState("");
  const [substitution, setSubstitution] = useState("CALL");
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState("");
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [name, setName] = useState(account?.name ?? "");
  const [email, setEmail] = useState(account?.email ?? "");
  const [phone, setPhone] = useState(account?.phone ?? "");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [placed, setPlaced] = useState<Placed | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);

  // Signed-in customers: offer their saved addresses, pre-filling the default one.
  useEffect(() => {
    if (!account) return;
    fetch("/api/account/addresses")
      .then((res) => res.json())
      .then((data: SavedAddress[]) => {
        const list = Array.isArray(data) ? data : [];
        setSavedAddresses(list);
        const def = list.find((a) => a.isDefault) ?? list[0];
        if (def) setAddress(def.address);
      })
      .catch(() => {});
  }, [account]);

  const discount = coupon ? Math.min(coupon.discount, subtotal) : 0;
  const deliveryFee = coupon?.freeDelivery ? 0 : deliveryFeeFor(settings, fulfillment, subtotal - discount);
  const total = subtotal - discount + deliveryFee;

  // A coupon's discount depends on the subtotal — drop it if the basket changes underneath it.
  useEffect(() => setCoupon(null), [subtotal]);

  const connectionError = () => t("Verbindungsfehler. Bitte versuchen Sie es erneut.", "Connection error. Please try again.");

  async function applyCoupon() {
    setCouponError("");
    if (!couponInput.trim()) return;
    setCheckingCoupon(true);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponInput, subtotal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCoupon(null);
        setCouponError(data.error || t("Ungültiger Code.", "Invalid code."));
      } else setCoupon(data);
    } catch {
      setCouponError(connectionError());
    }
    setCheckingCoupon(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNeedsLogin(false);
    setNeedsVerification(false);
    if (fulfillment === "DELIVERY" && !address.trim()) {
      setError(t("Bitte geben Sie Ihre Lieferadresse an.", "Please enter a delivery address."));
      return;
    }
    if (settings.requireSlot && slots.length > 0 && !slotId) {
      setError(t("Bitte wählen Sie ein Zeitfenster.", "Please choose a time slot."));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          customerEmail: email,
          customerPhone: phone,
          fulfillment,
          address: fulfillment === "DELIVERY" ? address : undefined,
          notes,
          couponCode: coupon?.code,
          slotId: slotId || undefined,
          substitution,
          items: cart.map((c) => ({ sizeId: c.sizeId, qty: c.qty })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) setNeedsLogin(true);
        if (data.code === "EMAIL_NOT_VERIFIED") setNeedsVerification(true);
        setError(data.error || t("Bestellung fehlgeschlagen. Bitte versuchen Sie es erneut.", "Could not place order. Please try again."));
      } else {
        setPlaced({ orderNumber: data.orderNumber, total: data.total, slot: slots.find((s) => s.id === slotId) ?? null, fulfillment });
      }
    } catch {
      setError(connectionError());
    }
    setSubmitting(false);
  }

  if (placed) {
    return (
      <div className="modal-backdrop">
        <div className="checkout-modal">
          <button className="close-modal" onClick={onSuccess} aria-label={t("Schließen", "Close")}>
            <X />
          </button>
          <span className="eyebrow">{t("Bestellung aufgegeben", "Order placed")}</span>
          <h2 style={{ fontSize: 40 }}>{t("Vielen Dank!", "Thank you!")}</h2>
          <p>
            {t("Ihre Bestellnummer ist", "Your order number is")} <b>#{placed.orderNumber}</b>.{" "}
            {t("Eine Bestätigung wurde an Ihre E-Mail gesendet.", "A confirmation has been sent to your email.")}
          </p>
          {placed.slot && (
            <p>
              <CalendarClock size={15} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
              {placed.fulfillment === "PICKUP" ? t("Abholung", "Pickup") : t("Lieferung", "Delivery")}: <b>{slotLabel(placed.slot, language)}</b>
            </p>
          )}
          <div className="checkout-box">
            <span>{t("Zu zahlen (bar)", "To pay (cash)")}</span>
            <b>{euro(placed.total)}</b>
          </div>
          <p style={{ fontSize: 12 }}>
            {t("Sie können den Status jederzeit unter", "You can follow the status any time under")}{" "}
            <Link href="/account" style={{ textDecoration: "underline" }}>
              {t("Mein Konto", "My account")}
            </Link>{" "}
            {t("verfolgen.", ".")}
          </p>
          <button className="primary-btn full" onClick={onSuccess}>
            {t("Fertig", "Done")} <Check size={17} />
          </button>
        </div>
      </div>
    );
  }

  const loginHint = (label: string) => (
    <>
      {" "}
      <Link href="/account" className="text-btn" style={{ display: "inline-flex", padding: 0 }}>
        {label}
      </Link>
      {" — "}
      {t("Ihr Warenkorb bleibt dabei erhalten.", "your basket will still be here.")}
    </>
  );

  return (
    <div className="modal-backdrop">
      <form className="checkout-modal" onSubmit={submit} style={{ maxHeight: "90vh", overflow: "auto" }}>
        <button type="button" className="close-modal" onClick={onClose} aria-label={t("Schließen", "Close")}>
          <X />
        </button>
        <span className="eyebrow">{t("Kasse", "Checkout")}</span>
        <h2 style={{ fontSize: 36 }}>{t("Bar bei Lieferung oder Abholung.", "Cash on delivery or pickup.")}</h2>
        <p>{t("Es wird keine Online-Zahlung durchgeführt. Sie zahlen bar bei Erhalt.", "No online payment is taken. You pay in cash when you receive your order.")}</p>

        {!settings.acceptingOrders && <div className="checkout-error">{settings.closedMessage}</div>}

        <div className="fulfillment-toggle">
          {settings.deliveryEnabled && (
            <button type="button" className={fulfillment === "DELIVERY" ? "fulfillment-btn active" : "fulfillment-btn"} onClick={() => setFulfillment("DELIVERY")}>
              <Truck size={16} /> {t("Lieferung", "Delivery")}
            </button>
          )}
          {settings.pickupEnabled && (
            <button type="button" className={fulfillment === "PICKUP" ? "fulfillment-btn active" : "fulfillment-btn"} onClick={() => setFulfillment("PICKUP")}>
              <Store size={16} /> {t("Abholung im Laden", "Pickup in store")}
            </button>
          )}
        </div>
        {fulfillment === "PICKUP" && (
          <p className="pickup-note">
            {t(
              `Wir packen Ihre Bestellung — Abholung im Laden oder am Straßenrand: ${STORE.street}, ${STORE.postalCode} ${STORE.city} (Mo–Sa 07:00–20:00).`,
              `We'll pack your order — pick it up in store or at the kerb: ${STORE.street}, ${STORE.postalCode} ${STORE.city} (Mon–Sat 07:00–20:00).`
            )}
          </p>
        )}
        {fulfillment === "DELIVERY" && settings.deliveryArea && (
          <p className="pickup-note">
            {t("Liefergebiet", "Delivery area")}: {settings.deliveryArea}
            {settings.freeDeliveryThreshold > 0 && ` · ${t(`ab €${settings.freeDeliveryThreshold} kostenlos`, `free from €${settings.freeDeliveryThreshold}`)}`}
          </p>
        )}

        {slots.length > 0 && (
          <label className="checkout-label">
            <span>
              <CalendarClock size={14} /> {fulfillment === "PICKUP" ? t("Abholzeit", "Pickup time") : t("Lieferzeit", "Delivery time")}
              {!settings.requireSlot && <small> ({t("optional", "optional")})</small>}
            </span>
            <select value={slotId} onChange={(e) => setSlotId(e.target.value)} required={settings.requireSlot}>
              <option value="">{settings.requireSlot ? t("Bitte wählen…", "Please choose…") : t("So bald wie möglich", "As soon as possible")}</option>
              {slots.map((s) => (
                <option key={s.id} value={s.id}>
                  {slotLabel(s, language)}
                  {s.remaining <= 2 ? ` — ${t(`noch ${s.remaining} frei`, `${s.remaining} left`)}` : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="checkout-fields">
          <input required autoComplete="name" placeholder={t("Vollständiger Name", "Full name")} value={name} onChange={(e) => setName(e.target.value)} />
          <input required type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input required type="tel" autoComplete="tel" placeholder={t("Telefonnummer", "Phone number")} value={phone} onChange={(e) => setPhone(e.target.value)} />
          {fulfillment === "DELIVERY" && (
            <>
              {savedAddresses.length > 0 && (
                <select
                  onChange={(e) => setAddress(e.target.value)}
                  defaultValue={address}
                  aria-label={t("Gespeicherte Adresse", "Saved address")}
                  style={{ padding: "10px 12px", border: "1px solid rgba(0,0,0,.12)", borderRadius: 8 }}
                >
                  {savedAddresses.map((a) => (
                    <option key={a.id} value={a.address}>
                      {a.label} — {a.address}
                    </option>
                  ))}
                  <option value="">{t("Andere Adresse eingeben…", "Enter a different address…")}</option>
                </select>
              )}
              <input
                required
                autoComplete="street-address"
                placeholder={t("Lieferadresse", "Delivery address")}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </>
          )}
          <label className="checkout-label">
            <span>
              <Repeat size={14} /> {t("Falls ein Artikel fehlt", "If an item is unavailable")}
            </span>
            <select value={substitution} onChange={(e) => setSubstitution(e.target.value)}>
              <option value="CALL">{t("Mich anrufen", "Call me")}</option>
              <option value="SUBSTITUTE">{t("Durch ähnlichen Artikel ersetzen", "Replace with a similar item")}</option>
              <option value="REMOVE">{t("Artikel weglassen", "Leave it out")}</option>
            </select>
          </label>
          <textarea
            placeholder={t("Hinweise zur Bestellung (optional, z. B. Klingel, Zuschnitt beim Fleisch)", "Order notes (optional, e.g. doorbell, how to cut the meat)")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={1000}
          />
        </div>

        <div className="coupon-row">
          <Ticket size={16} />
          <input
            placeholder={t("Gutscheincode", "Coupon code")}
            value={couponInput}
            onChange={(e) => {
              setCouponInput(e.target.value.toUpperCase());
              setCouponError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyCoupon();
              }
            }}
            aria-label={t("Gutscheincode", "Coupon code")}
          />
          {coupon ? (
            <button
              type="button"
              onClick={() => {
                setCoupon(null);
                setCouponInput("");
              }}
            >
              {t("Entfernen", "Remove")}
            </button>
          ) : (
            <button type="button" onClick={applyCoupon} disabled={checkingCoupon || !couponInput.trim()}>
              {checkingCoupon ? "…" : t("Einlösen", "Apply")}
            </button>
          )}
        </div>
        {couponError && <div className="checkout-error">{couponError}</div>}
        {coupon && (
          <small style={{ color: "var(--leaf)", display: "block", marginTop: 6 }}>
            <Check size={13} style={{ display: "inline", verticalAlign: "-2px" }} /> {coupon.code}
            {coupon.description ? ` — ${coupon.description}` : ""}
          </small>
        )}

        {error && (
          <div className="checkout-error">
            {error}
            {needsLogin && loginHint(t("Jetzt anmelden", "Log in now"))}
            {needsVerification && loginHint(t("E-Mail jetzt bestätigen", "Verify your email now"))}
          </div>
        )}

        <div className="checkout-box" style={{ flexDirection: "column", gap: 6, alignItems: "stretch" }}>
          <div style={row}>
            <span>{t("Zwischensumme", "Subtotal")}</span>
            <span>{euro(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div style={{ ...row, color: "var(--leaf)" }}>
              <span>
                {t("Rabatt", "Discount")} ({coupon?.code})
              </span>
              <span>−{euro(discount)}</span>
            </div>
          )}
          <div style={row}>
            <span>{fulfillment === "PICKUP" ? t("Abholung", "Pickup") : t("Lieferung", "Delivery")}</span>
            <span>{deliveryFee === 0 ? t("Kostenlos", "Free") : euro(deliveryFee)}</span>
          </div>
          <div style={{ ...row, fontWeight: 700, fontSize: 18, borderTop: "1px solid var(--line)", paddingTop: 6 }}>
            <span>{t("Gesamt (bar)", "Total (cash)")}</span>
            <span>{euro(total)}</span>
          </div>
        </div>

        <p className="privacy-note">
          {t("Ihre Angaben verwenden wir nur, um Ihre Bestellung auszuliefern bzw. bereitzustellen. Mehr in unserer ", "We only use your details to deliver or prepare your order. More in our ")}
          <Link href="/datenschutz">{t("Datenschutzerklärung", "Privacy Policy")}</Link>.{" "}
          {t("Hinweise zu Ihrem ", "Information on your ")}
          <Link href="/widerruf">{t("Widerrufsrecht", "right of withdrawal")}</Link>
          {t(" (gilt nicht für schnell verderbliche Lebensmittel).", " (does not apply to perishable food).")}
        </p>
        <button className="primary-btn full" disabled={submitting || cart.length === 0 || !settings.acceptingOrders}>
          {submitting ? t("Wird gesendet…", "Placing order…") : t("Zahlungspflichtig bestellen — Bar bezahlen", "Order and pay — cash on delivery")} <Check size={17} />
        </button>
      </form>
    </div>
  );
}
