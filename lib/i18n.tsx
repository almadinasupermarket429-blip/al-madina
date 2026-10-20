"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Language = "de" | "en";

const STORAGE_KEY = "almadina_language";

type LanguageContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  /** t("German text", "English text") — returns the string for the current language. German is the default/primary. */
  t: (de: string, en: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // German is the store's primary language — every page defaults here,
  // then swaps in the visitor's saved preference once read from storage.
  const [language, setLanguageState] = useState<Language>("de");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "de" || saved === "en") setLanguageState(saved);
    } catch {
      /* localStorage unavailable — stay on the German default */
    }
  }, []);

  function setLanguage(lang: Language) {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  }

  const t = (de: string, en: string) => (language === "de" ? de : en);

  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage() must be used within a LanguageProvider");
  return ctx;
}
