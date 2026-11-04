import type { Metadata } from "next";

// The page itself is a client component, so its title and canonical address live here.
export const metadata: Metadata = {
  title: "Impressum",
  description: "Impressum von Al-Madina Markt, Landwehrstraße 12, 97421 Schweinfurt.",
  alternates: { canonical: "/impressum" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
