"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, marginBottom: 10 }}>{title}</h2>
      <div style={{ lineHeight: 1.8, color: "#3a423d", fontSize: 14 }}>{children}</div>
    </section>
  );
}

export default function DatenschutzPage() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#18201b] py-12 px-4 md:px-8">
      <div className="w-full max-w-2xl mx-auto bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-black/5">
        <Link href="/" className="text-btn" style={{ display: "inline-flex", marginBottom: 24 }}>
          <ArrowLeft size={16} /> {t("Zurück zum Shop", "Back to shop")}
        </Link>

        <span className="eyebrow block mb-1">{t("Rechtliches", "Legal")}</span>
        <h1 style={{ fontSize: 32, marginBottom: 6 }}>{t("Datenschutzerklärung", "Privacy Policy")}</h1>
        <p style={{ fontSize: 12, color: "rgba(24,32,27,.5)", marginBottom: 24 }}>
          {t(
            "Diese Erklärung beschreibt tatsächlich, welche Daten diese Website verarbeitet. Die mit [PLATZHALTER] markierten Angaben müssen vor Veröffentlichung ergänzt und juristisch geprüft werden.",
            "This policy accurately describes what data this website actually processes. Fields marked [PLACEHOLDER] must be filled in and legally reviewed before going live."
          )}
        </p>

        <Section title={t("1. Verantwortlicher", "1. Data controller")}>
          <p>
            [{t("PLATZHALTER — vollständiger rechtlicher Name", "PLACEHOLDER — full legal name")}]
            <br />
            Al-Madina Markt, Landwehrstraße 12, 97421 Schweinfurt, {t("Deutschland", "Germany")}
            <br />
            {t("Telefon", "Phone")}: +49 163 8707437 · E-Mail: [{t("PLATZHALTER", "PLACEHOLDER")}]
          </p>
        </Section>

        <Section title={t("2. Übersicht der Verarbeitungen", "2. Overview of processing activities")}>
          <p>
            {t(
              "Diese Website verkauft Lebensmittel zur Lieferung oder Abholung. Es wird ausschließlich bar bei Lieferung/Abholung bezahlt — es werden zu keinem Zeitpunkt Zahlungsdaten (z. B. Kartendaten) erhoben oder verarbeitet.",
              "This website sells groceries for delivery or pickup. Payment is cash-on-delivery/pickup only — no payment data (e.g. card details) is ever collected or processed."
            )}
          </p>
        </Section>

        <Section title={t("3. Server-Logfiles", "3. Server log files")}>
          <p>
            {t(
              "Beim Aufruf dieser Website erhebt unser Hosting-Anbieter automatisch technische Daten (u. a. IP-Adresse, Datum/Uhrzeit, aufgerufene Seite, Browsertyp), um den Betrieb sicherzustellen und Missbrauch zu verhindern. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am sicheren Betrieb der Website).",
              "When you visit this site, our hosting provider automatically collects technical data (IP address, date/time, page requested, browser type) to keep the service running and prevent abuse. Legal basis: Art. 6(1)(f) GDPR (legitimate interest in secure operation)."
            )}
          </p>
        </Section>

        <Section title={t("4. Konto, Bestellungen und Kontaktdaten", "4. Account, orders, and contact data")}>
          <p style={{ marginBottom: 10 }}>
            {t(
              "Für ein Konto verarbeiten wir Name, E-Mail-Adresse, optional Telefonnummer, und ein gehashtes Passwort. Für eine Bestellung verarbeiten wir zusätzlich Ihre Liefer-/Abholangaben, ein gewähltes Zeitfenster, Ihren Wunsch bei nicht verfügbaren Artikeln, einen ggf. eingelösten Gutscheincode, bestellte Artikel und — bei Lieferung — Ihre Adresse. Diese Daten werden zur Vertragserfüllung benötigt (Art. 6 Abs. 1 lit. b DSGVO) und ohne sie kann keine Bestellung abgewickelt werden.",
              "For an account we process your name, email address, optionally a phone number, and a hashed password. For an order we additionally process your delivery/pickup details, any chosen time slot, your preference for unavailable items, any coupon code redeemed, ordered items, and — for delivery — your address. This data is required to fulfil the contract (Art. 6(1)(b) GDPR); without it we cannot process an order."
            )}
          </p>
          <p>
            {t(
              "Bestellungen müssen wir als Geschäftsunterlagen 8 Jahre aufbewahren (§§ 147 AO, 257 HGB). Ihre Kontaktdaten entfernen wir daraus aber schon 90 Tage nach Abschluss der Bestellung. Wie lange wir welche Daten speichern, steht in Abschnitt 9.",
              "We must keep orders as business records for 8 years (German tax/commercial law). We remove your contact details from them 90 days after the order is completed, though. Section 9 explains how long we keep which data."
            )}
          </p>
        </Section>

        <Section title={t("5. E-Mail-Bestätigung", "5. Email verification")}>
          <p>
            {t(
              "Bei der Registrierung senden wir einen einmaligen Bestätigungscode an Ihre E-Mail-Adresse, um zu verhindern, dass Bestellungen mit falschen oder fremden Kontaktdaten aufgegeben werden. Wenn Sie „Passwort vergessen“ nutzen, speichern wir für 60 Minuten nur einen gehashten Einmal-Link, der nach Gebrauch ungültig wird. Rechtsgrundlage: Art. 6 Abs. 1 lit. b und lit. f DSGVO.",
              "When you register, we send a one-time verification code to your email address to prevent orders being placed with false or someone else's contact details. If you use “forgot password”, we store only a hashed one-time link for 60 minutes, which becomes invalid once used. Legal basis: Art. 6(1)(b) and (f) GDPR."
            )}
          </p>
        </Section>

        <Section title={t("6. Bewertungen und Wunschliste", "6. Reviews and wishlist")}>
          <p>
            {t(
              "Wenn Sie eine Produktbewertung abgeben, werden Ihr Vorname mit dem Anfangsbuchstaben Ihres Nachnamens (z. B. „Ahmed K.“), die Bewertung und Ihr Kommentar öffentlich auf der Produktseite angezeigt. Rechtsgrundlage ist Ihre Einwilligung durch das Absenden (Art. 6 Abs. 1 lit. a DSGVO); Sie können eine Bewertung jederzeit löschen lassen. Ihre Wunschliste ist nur für Ihr eigenes Konto sichtbar.",
              "If you leave a product review, your first name and the initial of your last name (e.g. “Ahmed K.”), the rating and your comment are shown publicly on the product page. The legal basis is your consent by submitting it (Art. 6(1)(a) GDPR); you can have a review removed at any time. Your wishlist is only visible to your own account."
            )}
          </p>
        </Section>

        <Section title={t("7. Cookies", "7. Cookies")}>
          <p>
            {t(
              "Wir setzen ausschließlich technisch notwendige Cookies ein (Login-Sitzung, Warenkorb) — keine Analyse- oder Marketing-Cookies. Zusätzlich speichert Ihr Browser lokal nur Ihre gewählte Sprache und dass Sie den Cookie-Hinweis geschlossen haben. Rechtsgrundlage ist § 25 Abs. 2 Nr. 2 TDDDG (unbedingt erforderlich für den von Ihnen gewünschten Dienst). Details finden Sie in unseren ",
              "We only use strictly necessary cookies (login session, shopping cart) — no analytics or marketing cookies. In addition, your browser stores only your chosen language and that you closed the cookie notice. Legal basis: § 25(2) no. 2 TDDDG (strictly necessary for the service you requested). See our "
            )}
            <Link href="/cookie-einstellungen" style={{ color: "var(--green)", fontWeight: 700, textDecoration: "underline" }}>
              {t("Cookie-Einstellungen", "cookie settings")}
            </Link>{" "}
            {t("für Details.", "for details.")}
          </p>
        </Section>

        <Section title={t("8. Empfänger und Dienstleister", "8. Recipients and service providers")}>
          <p style={{ marginBottom: 10 }}>
            {t(
              "Zur Bereitstellung dieser Website und zum Versand von Bestellbestätigungen nutzen wir folgende Auftragsverarbeiter:",
              "To operate this website and send order confirmations, we use the following processors:"
            )}
          </p>
          <ul style={{ paddingLeft: 20, listStyle: "disc", display: "grid", gap: 6 }}>
            <li>
              {t(
                "Vercel Inc., USA — Hosting und Betrieb der Website (verarbeitet u. a. IP-Adressen beim Seitenaufruf). Serverstandort: Frankfurt am Main, Deutschland (EU).",
                "Vercel Inc., USA — website hosting and operation (processes e.g. IP addresses when pages are loaded). Server location: Frankfurt am Main, Germany (EU)."
              )}
            </li>
            <li>
              {t(
                "Neon Inc., USA — Datenbank, in der Konto- und Bestelldaten gespeichert werden. Serverstandort: Frankfurt am Main, Deutschland (EU).",
                "Neon Inc., USA — database storing account and order data. Server location: Frankfurt am Main, Germany (EU)."
              )}
            </li>
            <li>
              {t(
                "Cloudinary Ltd., USA — Speicherung der Produktfotos. Die Bilder werden über unseren eigenen Server ausgeliefert; Ihr Browser verbindet sich nicht direkt mit Cloudinary, und es werden dabei keine Daten von Ihnen an Cloudinary übermittelt.",
                "Cloudinary Ltd., USA — storage of product photos. Images are delivered through our own server; your browser does not connect to Cloudinary directly, and none of your data is sent to Cloudinary."
              )}
            </li>
            <li>
              {t(
                "[PLATZHALTER — E-Mail-Anbieter, z. B. Google Ireland Ltd. (Google Workspace)] — Versand von Bestätigungs-, Status- und Bestellbenachrichtigungs-E-Mails.",
                "[PLACEHOLDER — email provider, e.g. Google Ireland Ltd. (Google Workspace)] — sending confirmation, status and order notification emails."
              )}
            </li>
          </ul>
          <p style={{ marginTop: 10 }}>
            {t(
              "Mit allen Anbietern bestehen Verträge zur Auftragsverarbeitung nach Art. 28 DSGVO. Soweit Daten in die USA übermittelt werden, geschieht dies auf Grundlage des EU-US Data Privacy Framework (Art. 45 DSGVO) bzw. der EU-Standardvertragsklauseln (Art. 46 DSGVO).",
              "We have data processing agreements under Art. 28 GDPR with all providers. Where data is transferred to the USA, this is based on the EU-US Data Privacy Framework (Art. 45 GDPR) or the EU Standard Contractual Clauses (Art. 46 GDPR)."
            )}
          </p>
          <p style={{ marginTop: 10 }}>
            {t(
              "Bei Lieferungen erhält unser Lieferpersonal über einen persönlichen Link nur Name, Telefonnummer, Lieferadresse, Hinweise und die bestellten Artikel. Dieser Link funktioniert 48 Stunden nach Zustellung oder Stornierung nicht mehr.",
              "For deliveries, our delivery staff receive only your name, phone number, delivery address, notes and the ordered items through a personal link. The link stops working 48 hours after delivery or cancellation."
            )}
          </p>
        </Section>

        <Section title={t("9. Speicherdauer", "9. How long we keep data")}>
          <ul style={{ paddingLeft: 20, listStyle: "disc", display: "grid", gap: 6 }}>
            <li>{t("Kundenkonto: bis Sie es löschen (in Ihrem Konto unter „Konto löschen“).", "Customer account: until you delete it (in your account under “Delete account”).")}</li>
            <li>{t("Nicht per E-Mail bestätigte Registrierungen: 7 Tage.", "Sign-ups never confirmed by email: 7 days.")}</li>
            <li>{t("Warenkorb ohne Konto: 90 Tage nach der letzten Änderung.", "Shopping cart without an account: 90 days after the last change.")}</li>
            <li>{t("Bestätigungscodes und Links zum Zurücksetzen des Passworts: bis sie benutzt werden oder ablaufen (höchstens 60 Minuten).", "Verification codes and password-reset links: until used or expired (at most 60 minutes).")}</li>
            <li>{t("Kontaktdaten in Bestellungen (E-Mail, Telefon, Hinweise): 90 Tage nach Zustellung, Abholung oder Stornierung. Name und Adresse ebenfalls, außer bei Bestellungen über 250 €, für die eine vollständige Rechnung aufbewahrt werden muss. Wenn Sie Ihr Konto löschen, entfernen wir diese Daten sofort.", "Contact details in orders (email, phone, notes): 90 days after delivery, pickup or cancellation. Name and address too, except for orders over €250, which need a full invoice on file. If you delete your account, we remove them immediately.")}</li>
            <li>{t("Bestellungen selbst (Bestellnummer, Datum, Artikel, Beträge): 8 Jahre (gesetzliche Aufbewahrungspflicht), danach automatische Löschung.", "The orders themselves (order number, date, items, amounts): 8 years (statutory retention), then deleted automatically.")}</li>
            <li>{t("Protokoll der Änderungen im Verwaltungsbereich: 2 Jahre.", "Log of changes made in the admin area: 2 years.")}</li>
            <li>{t("Server-Logdateien: gemäß den Einstellungen unseres Hosting-Anbieters, in der Regel wenige Tage.", "Server log files: according to our hosting provider's settings, usually a few days.")}</li>
          </ul>
        </Section>

        <Section title={t("10. Keine automatisierte Entscheidungsfindung", "10. No automated decision-making")}>
          <p>
            {t(
              "Wir setzen kein Profiling oder automatisierte Entscheidungsfindung im Sinne von Art. 22 DSGVO ein.",
              "We do not use profiling or automated decision-making within the meaning of Art. 22 GDPR."
            )}
          </p>
        </Section>

        <Section title={t("11. Ihre Rechte", "11. Your rights")}>
          <p style={{ marginBottom: 10 }}>
            {t(
              "Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21 DSGVO). Wenden Sie sich hierzu an die oben genannte Kontaktadresse. Ihr Konto können Sie jederzeit selbst in Ihrem Kundenkonto löschen.",
              "You have the right to access (Art. 15), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18), data portability (Art. 20), and objection (Art. 21 GDPR). Contact us at the address above to exercise these rights. You can delete your account yourself at any time in your customer account."
            )}
          </p>
          <p>
            {t(
              "Außerdem haben Sie das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, z. B. beim Bayerischen Landesamt für Datenschutzaufsicht (BayLDA), Promenade 27, 91522 Ansbach.",
              "You also have the right to lodge a complaint with a data protection supervisory authority, e.g. the Bavarian State Office for Data Protection Supervision (BayLDA), Promenade 27, 91522 Ansbach, Germany."
            )}
          </p>
        </Section>

        <p style={{ fontSize: 12, color: "rgba(24,32,27,.5)" }}>
          {t(
            "Dieser Text wurde als Ausgangspunkt erstellt und ersetzt keine Rechtsberatung.",
            "This text was drafted as a starting point and does not replace legal advice."
          )}
        </p>
      </div>
    </main>
  );
}
