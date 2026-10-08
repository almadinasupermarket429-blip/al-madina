import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { Providers } from "./providers";
import { CookieNotice } from "./components/CookieNotice";
import { STORE, openingHoursSpecification } from "@/lib/store-info";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Local-business structured data: lets Google show address, hours and phone for the shop.
const storeJsonLd = {
  "@context": "https://schema.org",
  "@type": "GroceryStore",
  name: STORE.name,
  alternateName: STORE.arabicName,
  description: "Arabischer & türkischer Supermarkt mit Halal-Metzgerei in Schweinfurt.",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  image: `${SITE_URL}/logo.png`,
  telephone: STORE.phoneE164,
  priceRange: "€",
  paymentAccepted: "Cash",
  currenciesAccepted: "EUR",
  address: {
    "@type": "PostalAddress",
    streetAddress: STORE.street,
    postalCode: STORE.postalCode,
    addressLocality: STORE.city,
    addressCountry: STORE.countryCode,
  },
  geo: { "@type": "GeoCoordinates", latitude: STORE.geo.lat, longitude: STORE.geo.lng },
  hasMap: STORE.mapUrl,
  openingHoursSpecification: openingHoursSpecification(),
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Al-Madina Markt | Arabischer Supermarkt & Halal-Metzgerei in Schweinfurt",
    template: "%s | Al-Madina",
  },
  description:
    "Al-Madina Markt, Landwehrstraße 12, Schweinfurt: arabische, türkische & mediterrane Lebensmittel und frisches Halal-Fleisch. Online bestellen — Lieferung oder Abholung, bar bezahlen. Mo–Sa 7–20 Uhr.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Al-Madina Markt — Supermarkt & Halal-Metzgerei, Schweinfurt",
    description: "Arabische, türkische & mediterrane Lebensmittel und frisches Halal-Fleisch. Lieferung oder Abholung, bar bezahlen.",
    siteName: "Al-Madina Markt",
    locale: "de_DE",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#a12e3d",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Per-request CSP nonce from middleware.ts. Reading headers also makes every
  // page render per request, which the nonce needs (a cached page would carry a stale one).
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    // suppressHydrationWarning: browser translation rewrites lang/class on <html> before React loads.
    <html lang="de" suppressHydrationWarning>
      <body>
        {/* suppressHydrationWarning: browsers hide nonce attributes from the DOM, so React sees nonce="" on the client. */}
        <script type="application/ld+json" nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(storeJsonLd).replace(/</g, "\\u003c") }} />
        <Providers>
          {children}
          <CookieNotice />
        </Providers>
      </body>
    </html>
  );
}
