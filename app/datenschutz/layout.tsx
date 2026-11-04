import type { Metadata } from "next";

// The page itself is a client component, so its title and canonical address live here.
export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  description: "Wie Al-Madina Markt Ihre Daten beim Einkaufen, Bestellen und Liefern verarbeitet.",
  alternates: { canonical: "/datenschutz" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
