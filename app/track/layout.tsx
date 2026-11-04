import type { Metadata } from "next";

// Personal or staff-only pages: never in search results (robots.ts also disallows crawling them).
export const metadata: Metadata = {
  title: "Bestellung verfolgen",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
