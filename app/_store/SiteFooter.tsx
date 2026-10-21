import Link from "next/link";
import { Facebook, Instagram } from "lucide-react";
import { STORE } from "@/lib/store-info";
import type { Translate } from "./types";
import { MAP_URL, PHONE_LINK } from "./ui";

export function SiteFooter({ t }: { t: Translate }) {
  return (
    <footer>
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
        <div className="footer-main">
          <div>
            <a href="#top" className="footer-logo-wrap">
              <img src="/logo.png" alt="Al-Madina Markt logo" className="footer-logo" />
              <span className="header-logo-text">
                <b>al-madina</b>
                <small>market · seit 1998</small>
              </span>
            </a>
            <p className="footer-note">
              {t("Arabische, türkische & mediterrane Lebensmittel und Halal-Fleisch für Ihren Alltag.", "Arabic, Turkish & Mediterranean groceries and halal meat for your everyday table.")}
            </p>
          </div>
          <div className="footer-links">
            <div>
              <b>{t("Entdecken", "Discover")}</b>
              <a href="#shop">Shop</a>
              <a href="#fresh">{t("Täglich frisch", "Fresh daily")}</a>
              <a href="#story">{t("Unsere Geschichte", "Our story")}</a>
            </div>
            <div>
              <b>{t("Besuchen", "Visit")}</b>
              <a href={MAP_URL} target="_blank" rel="noreferrer">
                Google Maps
              </a>
              <a href={PHONE_LINK}>{t("Anrufen", "Call")}</a>
              <a href="#visit">{t("Öffnungszeiten", "Opening hours")}</a>
              <span className="footer-hours">
                {t("Mo–Sa 07:00–20:00", "Mon–Sat 07:00–20:00")}
                <br />
                {t("So geschlossen", "Sun closed")}
              </span>
            </div>
            <div>
              <b>{t("Folgen", "Follow")}</b>
              <a href="https://www.instagram.com/" target="_blank" rel="noreferrer">
                <Instagram size={15} /> Instagram
              </a>
              <a href="https://www.facebook.com/" target="_blank" rel="noreferrer">
                <Facebook size={15} /> Facebook
              </a>
            </div>
            <div>
              <b>{t("Rechtliches", "Legal")}</b>
              <Link href="/impressum">Impressum</Link>
              <Link href="/datenschutz">{t("Datenschutz", "Privacy Policy")}</Link>
              <Link href="/widerruf">{t("Widerrufsbelehrung", "Right of withdrawal")}</Link>
              <Link href="/widerruf#widerrufen">{t("Vertrag widerrufen", "Withdraw from contract")}</Link>
              <Link href="/cookie-einstellungen">{t("Cookie-Einstellungen", "Cookie Settings")}</Link>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} {STORE.name} · {STORE.street}, {STORE.postalCode} {STORE.city}
          </span>
          <span>{t("Zahlung ausschließlich in bar bei Lieferung oder Abholung.", "Payment is cash only, on delivery or pickup.")}</span>
        </div>
      </div>
    </footer>
  );
}
