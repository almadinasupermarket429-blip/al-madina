"use client";

import { useState } from "react";
import { Menu, Phone, Search, ShoppingBag, Truck, User, X } from "lucide-react";
import type { StoreSettings } from "@/lib/settings-shared";
import type { Account, Language, Translate } from "./types";
import { PHONE, PHONE_LINK } from "./ui";

type Props = {
  settings: StoreSettings;
  account: Account | null;
  cartCount: number;
  query: string;
  onQueryChange: (q: string) => void;
  onOpenCart: () => void;
  onOpenMobileSearch: () => void;
  language: Language;
  setLanguage: (l: Language) => void;
  t: Translate;
};

const SECTION_LINKS: [string, string, string][] = [
  ["#shop", "Shop", "Shop"],
  ["#fresh", "Täglich frisch", "Fresh daily"],
  ["#story", "Unsere Geschichte", "Our story"],
  ["#visit", "Besuchen Sie uns", "Visit us"],
];

/** Announcement bar, sticky header with search and basket, and the mobile menu. */
export function SiteHeader({ settings, account, cartCount, query, onQueryChange, onOpenCart, onOpenMobileSearch, language, setLanguage, t }: Props) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const otherLanguage = language === "de" ? "en" : "de";
  const closeNav = () => setMobileNavOpen(false);

  return (
    <>
      <div className="topbar">
        {!settings.acceptingOrders ? (
          <strong>{settings.closedMessage}</strong>
        ) : settings.announcement ? (
          <strong>{settings.announcement}</strong>
        ) : (
          <>
            {t("Kostenlose Abholung in Schweinfurt", "Free pickup in Schweinfurt")}
            {settings.freeDeliveryThreshold > 0 && (
              <>
                {" "}
                · <strong>€{settings.freeDeliveryThreshold}+</strong> {t("für kostenlose Lieferung", "for free delivery")}
              </>
            )}{" "}
            · {t("Zahlung bar bei Lieferung/Abholung", "Cash on delivery/pickup")}
          </>
        )}
      </div>

      <header className="sticky top-0 z-40 border-b border-black/5 bg-[#f8f7f3]/95 backdrop-blur-xl">
        <div className="nav-row">
          <a href="#top" className="header-logo group nav-left" aria-label="Al-Madina home">
            <img src="/logo.png" alt="Al-Madina Markt logo" className="logo-image" />
            <span className="header-logo-text">
              <b>al-madina</b>
              <small>market · seit 1998</small>
            </span>
          </a>

          <div className="nav-center">
            <nav className="nav-links">
              {SECTION_LINKS.map(([href, de, en]) => (
                <a key={href} href={href}>
                  {t(de, en)}
                </a>
              ))}
            </nav>
            <div className="nav-search">
              <Search size={18} className="text-black/40" />
              <input
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder={t("Produkte suchen…", "Search products…")}
                className="ml-2 w-full bg-transparent text-sm outline-none"
              />
            </div>
          </div>

          <div className="nav-right">
            <div className="nav-extra">
              <button onClick={() => setLanguage(otherLanguage)} className="language-btn" aria-label={t("Sprache wechseln", "Change language")}>
                {language === "de" ? "English" : "Deutsch"}
              </button>
              <a className="icon-btn hidden sm:flex" href={PHONE_LINK} aria-label={t("Al-Madina anrufen", "Call Al-Madina")}>
                <Phone size={19} />
              </a>
              <a className="icon-btn" href="/track" aria-label={t("Bestellung verfolgen", "Track order")} title={t("Bestellung verfolgen", "Track order")}>
                <Truck size={19} />
              </a>
              <a className="icon-btn" href="/account" aria-label={t("Mein Konto", "My account")} title={account ? account.name : t("Anmelden", "Sign in")}>
                <User size={19} />
              </a>
            </div>
            <button className="cart-btn" onClick={onOpenCart} aria-label="Open basket">
              <ShoppingBag size={19} />
              <span>{t("Warenkorb", "Basket")}</span>
              <i>{cartCount}</i>
            </button>
            <button className="nav-toggle" onClick={() => setMobileNavOpen(true)} aria-label={t("Menü öffnen", "Open menu")}>
              <Menu size={19} />
            </button>
          </div>
        </div>
      </header>

      {mobileNavOpen && (
        <div className="drawer-backdrop" onClick={closeNav}>
          <aside className="mobile-nav-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span className="header-logo-text">
                <b style={{ fontSize: 18 }}>al-madina</b>
              </span>
              <button onClick={closeNav} className="icon-btn" aria-label={t("Menü schließen", "Close menu")}>
                <X size={18} />
              </button>
            </div>
            <button
              onClick={() => {
                closeNav();
                onOpenMobileSearch();
              }}
            >
              <Search size={17} /> {t("Produkte suchen", "Search products")}
            </button>
            <div className="mobile-nav-divider" />
            {SECTION_LINKS.map(([href, de, en]) => (
              <a key={href} href={href} onClick={closeNav}>
                {t(de, en)}
              </a>
            ))}
            <div className="mobile-nav-divider" />
            <a href="/track" onClick={closeNav}>
              <Truck size={17} /> {t("Bestellung verfolgen", "Track order")}
            </a>
            <a href="/account" onClick={closeNav}>
              <User size={17} /> {account ? account.name : t("Anmelden", "Sign in")}
            </a>
            <a href={PHONE_LINK} onClick={closeNav}>
              <Phone size={17} /> {PHONE}
            </a>
            <div className="mobile-nav-divider" />
            <button
              onClick={() => {
                setLanguage(otherLanguage);
                closeNav();
              }}
            >
              {language === "de" ? "English" : "Deutsch"}
            </button>
          </aside>
        </div>
      )}
    </>
  );
}
