"use client";

import { LanguageProvider, useLanguage } from "@/lib/i18n";

/** First thing a keyboard user reaches: jumps past the header to the page's <main id="main">. */
function SkipLink() {
  const { t } = useLanguage();
  return (
    <a href="#main" className="skip-link">
      {t("Zum Inhalt springen", "Skip to content")}
    </a>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <SkipLink />
      {children}
    </LanguageProvider>
  );
}
