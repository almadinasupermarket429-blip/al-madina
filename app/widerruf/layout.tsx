import type { Metadata } from "next";

// The page itself is a client component, so its title and canonical address live here.
export const metadata: Metadata = {
  title: "Widerrufsbelehrung",
  description: "Widerrufsrecht, Muster-Widerrufsformular und Online-Widerruf für Bestellungen bei Al-Madina Markt.",
  alternates: { canonical: "/widerruf" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
