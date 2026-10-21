"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useLanguage();
  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#18201b] flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-sm border border-black/5">
        <div className="icon-btn mx-auto mb-5" style={{ width: 56, height: 56, color: "#b3261e" }}>
          <AlertTriangle size={26} />
        </div>
        <span className="eyebrow block mb-1">{t("Fehler", "Error")}</span>
        <h1 style={{ fontSize: 26, margin: "8px 0 8px" }}>{t("Etwas ist schiefgelaufen", "Something went wrong")}</h1>
        <p style={{ color: "rgba(24,32,27,.7)", fontSize: 14, marginBottom: 24 }}>
          {t("Bitte versuchen Sie es erneut — falls das Problem weiterhin besteht, laden Sie die Seite neu.", "Please try again — if the problem keeps happening, reload the page.")}
        </p>
        <button onClick={reset} className="primary-btn full" style={{ justifyContent: "center" }}>
          <RotateCcw size={16} /> {t("Erneut versuchen", "Try again")}
        </button>
      </div>
    </main>
  );
}
