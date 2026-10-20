// The static marketing sections of the home page: hero, benefits, fresh produce, story, visit.
import { ArrowRight, Beef, Check, Clock3, Leaf, MapPin, Navigation, Phone, Sparkles, Truck } from "lucide-react";
import { OPENING_HOURS, STORE, type storeOpenState } from "@/lib/store-info";
import type { Translate } from "./types";
import { MAP_URL, PHONE, PHONE_LINK } from "./ui";

type OpenState = ReturnType<typeof storeOpenState> | null;

function OpenBadge({ openState, long, t }: { openState: NonNullable<OpenState>; long: boolean; t: Translate }) {
  const label = long
    ? openState.open
      ? t(`Jetzt geöffnet · bis ${openState.closesAt} Uhr`, `Open now · until ${openState.closesAt}`)
      : t(`Geschlossen · öffnet ${openState.nextOpen ?? ""}`, `Closed · opens ${openState.nextOpen ?? ""}`)
    : openState.open
      ? t("Jetzt geöffnet", "Open now")
      : t("Geschlossen", "Closed");
  return (
    <span className={openState.open ? "open-badge open" : "open-badge"}>
      <i />
      {label}
    </span>
  );
}

export function Hero({ openState, t }: { openState: OpenState; t: Translate }) {
  return (
    <>
      <section id="top" className="hero reveal mx-auto grid max-w-7xl gap-6 px-5 pb-8 pt-6 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:pt-10">
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles size={15} /> {t("Authentischer Geschmack. Jeden Tag frisch.", "Authentic taste. Fresh every day.")}
          </div>
          <h1>
            {t("Ihr arabischer & türkischer Markt,", "Your Arabic & Turkish market,")}
            <br />
            <em>{t("ganz in Ihrer Nähe.", "right around the corner.")}</em>
          </h1>
          <p>
            {t(
              "Supermarkt und Halal-Metzgerei unter einem Dach: frisches Fleisch, Gemüse, warmes Brot, Olivenöl, Gewürze, Meze und Süßigkeiten – sorgfältig für Ihren Alltag ausgewählt.",
              "Supermarket and halal butcher under one roof: fresh meat, vegetables, warm bread, olive oil, spices, meze and sweets — chosen for your everyday table."
            )}
          </p>
          <div className="hero-actions">
            <a href="#shop" className="primary-btn">
              {t("Markt entdecken", "Explore the market")} <ArrowRight size={18} />
            </a>
            <a href={MAP_URL} target="_blank" rel="noreferrer" className="text-btn">
              <MapPin size={17} /> {t("Unser Geschäft finden", "Find our store")}
            </a>
          </div>
          <div className="trust-row">
            {openState && <OpenBadge openState={openState} long t={t} />}
            <span>
              <Check /> {t("Täglich frisch", "Fresh daily")}
            </span>
            <span>
              <Check /> {t("Halal-Metzgerei", "Halal butcher")}
            </span>
            <span>
              <Check /> {t("Familiengeführt", "Family run")}
            </span>
          </div>
        </div>
        <div className="hero-image-wrap">
          <img src="/images/hero-market.jpg" alt="Fresh vegetables at a market" className="hero-image" />
          <div className="hero-card">
            <span>{t("Heute auf dem Markt", "In the market today")}</span>
            <b>
              {t("Frische Produkte", "Fresh produce")}
              <br />
              {t("ab €1,19", "from €1.19")}
            </b>
            <a href="#fresh">
              {t("Frische entdecken", "Discover fresh")} <ArrowRight size={14} />
            </a>
          </div>
          <div className="hero-stamp">
            <Leaf size={22} />
            <span>
              GOOD
              <br />
              <b>FOOD</b>
            </span>
          </div>
        </div>
      </section>

      <section className="benefits reveal">
        <div>
          <Truck />
          <b>{t("Lokale Lieferung", "Local delivery")}</b>
          <span>{t("Schnell & sorgfältig", "Fast & careful")}</span>
        </div>
        <div>
          <Leaf />
          <b>{t("Frische Produkte", "Fresh produce")}</b>
          <span>{t("Täglich ausgewählt", "Selected daily")}</span>
        </div>
        <div>
          <Beef />
          <b>{t("Halal-Metzgerei", "Halal butcher")}</b>
          <span>{t("Frisch an der Theke", "Fresh at the counter")}</span>
        </div>
        <div>
          <Clock3 />
          <b>{t("Mo–Sa geöffnet", "Open Mon–Sat")}</b>
          <span>07:00 — 20:00</span>
        </div>
      </section>
    </>
  );
}

export function FreshBand({ t }: { t: Translate }) {
  return (
    <section id="fresh" className="feature-band reveal">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 lg:grid-cols-2 lg:px-8 lg:py-20">
        <div>
          <span className="eyebrow light">{t("Jeden Morgen frisch", "Fresh every morning")}</span>
          <h2>
            {t("Bringen Sie den Markt", "Bring the market")}
            <br />
            <em>{t("in Ihre Küche.", "into your kitchen.")}</em>
          </h2>
          <p>
            {t(
              "Frische Kräuter, reife Tomaten, knackige Gurken und saisonales Obst – ausgewählt, damit Kochen jeden Tag Freude macht.",
              "Fresh herbs, ripe tomatoes, crisp cucumbers and seasonal fruit — chosen so cooking is a joy every day."
            )}
          </p>
          <a href="#shop" className="light-btn">
            {t("Frische Produkte kaufen", "Shop fresh produce")} <ArrowRight size={17} />
          </a>
        </div>
        <div className="feature-photo">
          <img src="/images/feature-produce.jpg" alt="Fresh produce market display" />
          <div>
            <b>{t("Sorgfältig ausgewählt.", "Carefully chosen.")}</b>
            <span>{t("Qualität, die man sieht.", "Quality you can see.")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Story({ t }: { t: Translate }) {
  return (
    <section id="story" className="story reveal mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[.9fr_1.1fr] lg:px-8">
      <div className="story-photo">
        <img src="/images/story-shelves.jpg" alt="Grocery store shelves" />
      </div>
      <div className="story-copy">
        <span className="eyebrow">{t("Unsere kleine Ecke des Orients", "Our little corner of the Orient")}</span>
        <h2>
          {t("Ein Markt rund um", "A market built around")} <em>{t("die gemeinsame Tafel.", "the shared table.")}</em>
        </h2>
        <p>
          {t(
            "Al-Madina ist ein Nachbarschaftsmarkt für Menschen, die Zutaten, Gastfreundschaft und die kleinen Rituale rund ums Essen schätzen.",
            "Al-Madina is a neighbourhood market for people who value good ingredients, hospitality, and the small rituals around food."
          )}
        </p>
        <div className="quote">
          <div className="stars">★★★★★</div>
          <p>{t("„Eine warme, großzügige Auswahl arabischer, türkischer und mediterraner Favoriten.“", "“A warm, generous selection of Arabic, Turkish and Mediterranean favourites.”")}</p>
        </div>
        <a href={MAP_URL} target="_blank" rel="noreferrer" className="outline-btn">
          <MapPin size={17} /> {t("Route planen", "Get directions")}
        </a>
      </div>
    </section>
  );
}

export function Visit({ openState, t }: { openState: OpenState; t: Translate }) {
  return (
    <section id="visit" className="visit reveal">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="visit-grid">
          <div>
            <span className="eyebrow">{t("Kommen Sie vorbei", "Come visit")}</span>
            <h2>
              {t("Wir sehen uns bei", "See you at")} <em>Al-Madina.</em>
            </h2>
            <p className="store-arabic" dir="rtl" lang="ar">
              {STORE.arabicName}
            </p>
            <p>
              {STORE.street}
              <br />
              {STORE.postalCode} {STORE.city}, {t("Deutschland", "Germany")}
            </p>
            <ul className="service-list">
              {STORE.services.map((svc) => (
                <li key={svc.key}>
                  <Check size={15} /> {t(svc.de, svc.en)}
                </li>
              ))}
            </ul>
            <div className="visit-links">
              <a href={STORE.directionsUrl} target="_blank" rel="noreferrer">
                <Navigation size={17} /> {t("Route planen", "Get directions")}
              </a>
              <a href={PHONE_LINK}>
                <Phone size={17} /> {PHONE}
              </a>
              <a href={MAP_URL} target="_blank" rel="noreferrer">
                <MapPin size={17} /> Plus Code: {STORE.plusCode}
              </a>
            </div>
            <div className="hours">
              <b style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {t("Öffnungszeiten", "Opening hours")}
                {openState && <OpenBadge openState={openState} long={false} t={t} />}
              </b>
              {OPENING_HOURS.map((h) => (
                <span key={h.day} className={openState && new Date().getDay() === h.day ? "today" : undefined}>
                  {t(h.de, h.en)} <strong>{h.open ? `${h.open} — ${h.close}` : t("Geschlossen", "Closed")}</strong>
                </span>
              ))}
            </div>
          </div>
          <div className="map-card">
            <div className="map-grid"></div>
            <div className="pin">
              <MapPin size={26} />
              <b>Al-Madina</b>
              <small>{STORE.street}</small>
            </div>
            <a href={MAP_URL} target="_blank" rel="noreferrer" className="map-overlay">
              {t("In Google Maps öffnen", "Open in Google Maps")} <ArrowRight size={15} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
