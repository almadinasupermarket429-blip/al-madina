import type { Metadata } from "next";

// The page itself is a client component, so its title and canonical address live here.
export const metadata: Metadata = {
  title: "Cookie-Einstellungen",
  description: "Welche Cookies Al-Madina Markt verwendet: nur technisch notwendige.",
  alternates: { canonical: "/cookie-einstellungen" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
