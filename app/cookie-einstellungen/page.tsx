"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

type CookieRow = { name: string; purpose: [string, string]; duration: [string, string] };

const COOKIES: CookieRow[] = [
  {
    name: "almadina_customer_session",
    purpose: ["Hält Sie in Ihrem Konto angemeldet.", "Keeps you signed in to your account."],
    duration: ["60 Tage", "60 days"],
  },
  {
    name: "almadina_admin_session",
    purpose: ["Anmeldesitzung für das Store-Verwaltungsportal.", "Login session for the store admin portal."],
    duration: ["30 Tage", "30 days"],
  },
  {
    name: "almadina_guest_cart",
    purpose: [
      "Merkt sich Ihren Warenkorb, bevor Sie sich anmelden.",
      "Remembers your shopping cart before you sign in.",
    ],
    duration: ["90 Tage", "90 days"],
  },
  {
    name: "almadina_language",
    purpose: [
      "Browser-Speicher (kein Cookie): merkt sich die von Ihnen gewählte Sprache.",
      "Browser storage (not a cookie): remembers the language you chose.",
    ],
    duration: ["bis Sie ihn löschen", "until you clear it"],
  },
  {
    name: "almadina_cookie_notice_ack",
    purpose: [
      "Browser-Speicher (kein Cookie): merkt sich, dass Sie diesen Hinweis geschlossen haben.",
      "Browser storage (not a cookie): remembers that you closed this notice.",
    ],
    duration: ["bis Sie ihn löschen", "until you clear it"],
  },
];

export default function CookieEinstellungenPage() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#18201b] py-12 px-4 md:px-8">
      <div className="w-full max-w-2xl mx-auto bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-black/5">
        <Link href="/" className="text-btn" style={{ display: "inline-flex", marginBottom: 24 }}>
          <ArrowLeft size={16} /> {t("Zurück zum Shop", "Back to shop")}
        </Link>

        <span className="eyebrow block mb-1">{t("Rechtliches", "Legal")}</span>
        <h1 style={{ fontSize: 32, marginBottom: 10 }}>{t("Cookie-Einstellungen", "Cookie settings")}</h1>

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            background: "rgba(79,157,95,.08)",
            border: "1px solid rgba(79,157,95,.25)",
            borderRadius: 14,
            padding: 16,
            marginBottom: 24,
          }}
        >
          <ShieldCheck size={20} color="var(--leaf)" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 13, lineHeight: 1.7, margin: 0, color: "#2f6b3a" }}>
            {t(
              "Diese Website verwendet ausschließlich technisch notwendige Cookies. Es gibt keine Analyse-, Werbe- oder Tracking-Cookies — daher auch nichts, das Sie hier ein- oder ausschalten müssten.",
              "This website only uses strictly necessary cookies. There are no analytics, advertising, or tracking cookies — so there's nothing here for you to switch on or off."
            )}
          </p>
        </div>

        <h2 style={{ fontSize: 16, marginBottom: 12 }}>{t("Technisch notwendige Cookies", "Strictly necessary cookies")}</h2>
        <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
          {COOKIES.map((c) => (
            <div key={c.name} className="bg-white rounded-xl border border-black/5" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <code style={{ fontSize: 12, fontWeight: 700, background: "rgba(0,0,0,.04)", padding: "2px 8px", borderRadius: 6 }}>
                  {c.name}
                </code>
                <span style={{ fontSize: 11, color: "rgba(24,32,27,.5)" }}>{t(c.duration[0], c.duration[1])}</span>
              </div>
              <p style={{ fontSize: 13, margin: 0, color: "#454f49" }}>{t(c.purpose[0], c.purpose[1])}</p>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 13, color: "rgba(24,32,27,.6)", lineHeight: 1.7 }}>
          {t(
            "Da diese Cookies für den Betrieb des Shops (Anmeldung, Warenkorb) erforderlich sind, können sie nicht deaktiviert werden, ohne diese Funktionen unbrauchbar zu machen. Weitere Informationen finden Sie in unserer ",
            "Because these cookies are required for the shop to function (login, cart), they can't be disabled without breaking those features. See our "
          )}
          <Link href="/datenschutz" style={{ color: "var(--green)", fontWeight: 700, textDecoration: "underline" }}>
            {t("Datenschutzerklärung", "Privacy Policy")}
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
