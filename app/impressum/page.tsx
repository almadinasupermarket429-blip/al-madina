"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export default function ImpressumPage() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#18201b] py-12 px-4 md:px-8">
      <div className="w-full max-w-2xl mx-auto bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-black/5">
        <Link href="/" className="text-btn" style={{ display: "inline-flex", marginBottom: 24 }}>
          <ArrowLeft size={16} /> {t("Zurück zum Shop", "Back to shop")}
        </Link>

        <span className="eyebrow block mb-1">{t("Rechtliches", "Legal")}</span>
        <h1 style={{ fontSize: 32, marginBottom: 24 }}>Impressum</h1>

        <div className="checkout-error" style={{ marginBottom: 24 }}>
          {t(
            "Platzhalter — dieser Impressum-Entwurf muss mit den echten Geschäftsangaben vervollständigt und vor Veröffentlichung juristisch geprüft werden.",
            "Placeholder — this Impressum draft must be completed with the real business details and legally reviewed before going live."
          )}
        </div>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>{t("Angaben gemäß § 5 DDG", "Information according to § 5 DDG")}</h2>
          <p style={{ lineHeight: 1.8 }}>
            [{t("Vollständiger rechtlicher Name / Rechtsform — PLATZHALTER", "Full legal name / legal form — PLACEHOLDER")}]
            <br />
            Al-Madina Markt
            <br />
            Landwehrstraße 12
            <br />
            97421 Schweinfurt
            <br />
            {t("Deutschland", "Germany")}
          </p>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>{t("Kontakt", "Contact")}</h2>
          <p style={{ lineHeight: 1.8 }}>
            {t("Telefon", "Phone")}: +49 163 8707437
            <br />
            E-Mail: [{t("PLATZHALTER — öffentliche Kontakt-E-Mail", "PLACEHOLDER — public contact email")}]
          </p>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>{t("Umsatzsteuer-ID", "VAT ID")}</h2>
          <p style={{ lineHeight: 1.8 }}>
            {t(
              "Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz:",
              "VAT identification number according to § 27a of the German VAT Act:"
            )}{" "}
            [{t("PLATZHALTER, falls vorhanden", "PLACEHOLDER, if applicable")}]
          </p>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>{t("Handelsregister", "Commercial register")}</h2>
          <p style={{ lineHeight: 1.8 }}>
            [{t("PLATZHALTER — Registergericht und Registernummer, falls im Handelsregister eingetragen", "PLACEHOLDER — register court and register number, if registered in the commercial register")}]
          </p>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>
            {t("Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV", "Responsible for content according to § 18 (2) MStV")}
          </h2>
          <p style={{ lineHeight: 1.8 }}>
            [{t("PLATZHALTER — vollständiger Name der verantwortlichen Person", "PLACEHOLDER — full name of the responsible person")}]
            <br />
            Landwehrstraße 12, 97421 Schweinfurt
          </p>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>{t("Streitschlichtung", "Dispute resolution")}</h2>
          <p style={{ lineHeight: 1.8 }}>
            {t(
              "Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen. [PLATZHALTER — bitte bestätigen oder anpassen]",
              "We are not obliged and not willing to participate in dispute resolution proceedings before a consumer arbitration board. [PLACEHOLDER — please confirm or amend]"
            )}
          </p>
        </section>

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
