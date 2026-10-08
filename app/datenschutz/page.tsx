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
              "Bestelldaten unterliegen gesetzlichen Aufbewahrungsfristen für Geschäftsunterlagen (i. d. R. 6–10 Jahre nach §§ 147 AO, 257 HGB) und werden danach gelöscht.",
              "Order data is subject to statutory retention periods for business records (generally 6–10 years under German tax/commercial law) and is deleted afterward."
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
              "Wenn Sie eine Produktbewertung abgeben, werden Ihr angezeigter Name, die Bewertung und Ihr Kommentar öffentlich auf der Produktseite angezeigt. Ihre Wunschliste ist nur für Ihr eigenes Konto sichtbar.",
              "If you leave a product review, your displayed name, rating, and comment are shown publicly on the product page. Your wishlist is only visible to your own account."
            )}
          </p>
        </Section>

        <Section title={t("7. Cookies", "7. Cookies")}>
          <p>
            {t(
              "Wir setzen ausschließlich technisch notwendige Cookies ein (Login-Sitzung, Warenkorb) — keine Analyse- oder Marketing-Cookies. Details finden Sie in unseren ",
              "We only use strictly necessary cookies (login session, shopping cart) — no analytics or marketing cookies. See our "
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
            <li>{t("Hosting/Betrieb der Website (z. B. Vercel Inc.)", "Website hosting/operation (e.g. Vercel Inc.)")}</li>
            <li>{t("Datenbank-Hosting (z. B. Neon)", "Database hosting (e.g. Neon)")}</li>
            <li>{t("E-Mail-Versand für Bestellbestätigungen (SMTP-Anbieter)", "Email delivery for order confirmations (SMTP provider)")}</li>
          </ul>
          <p style={{ marginTop: 10 }}>
            {t(
              "Einige dieser Anbieter können Daten außerhalb der EU/des EWR verarbeiten; in diesem Fall stellen wir geeignete Garantien sicher (z. B. EU-Standardvertragsklauseln). [PLATZHALTER — bitte konkrete Anbieter und Serverstandorte ergänzen]",
              "Some of these providers may process data outside the EU/EEA; where this is the case, appropriate safeguards are in place (e.g. EU Standard Contractual Clauses). [PLACEHOLDER — please confirm the actual providers and server locations]"
            )}
          </p>
        </Section>

        <Section title={t("9. Keine automatisierte Entscheidungsfindung", "9. No automated decision-making")}>
          <p>
            {t(
              "Wir setzen kein Profiling oder automatisierte Entscheidungsfindung im Sinne von Art. 22 DSGVO ein.",
              "We do not use profiling or automated decision-making within the meaning of Art. 22 GDPR."
            )}
          </p>
        </Section>

        <Section title={t("10. Ihre Rechte", "10. Your rights")}>
          <p style={{ marginBottom: 10 }}>
            {t(
              "Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21 DSGVO). Wenden Sie sich hierzu an die oben genannte Kontaktadresse.",
              "You have the right to access (Art. 15), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18), data portability (Art. 20), and objection (Art. 21 GDPR). Contact us at the address above to exercise these rights."
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
