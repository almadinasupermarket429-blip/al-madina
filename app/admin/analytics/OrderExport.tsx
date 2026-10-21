"use client";

import { useState } from "react";
import { Download } from "lucide-react";

const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

/** Download orders in a date range as CSV (for the accountant / bookkeeping). */
export function OrderExport({ t }: { t: (de: string, en: string) => string }) {
  const [from, setFrom] = useState(() => `${today().slice(0, 7)}-01`);
  const [to, setTo] = useState(today);

  return (
    <div className="admin-card !p-4 mb-8 flex flex-wrap items-end gap-3">
      <div className="mr-auto">
        <b className="block">{t("Bestellungen exportieren", "Export orders")}</b>
        <span className="text-xs text-black/50">{t("Als CSV für Excel oder die Buchhaltung.", "As CSV for Excel or your bookkeeping.")}</span>
      </div>
      <label className="text-xs text-black/60 grid gap-1">
        {t("Von", "From")}
        <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="input !py-1.5" />
      </label>
      <label className="text-xs text-black/60 grid gap-1">
        {t("Bis", "To")}
        <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="input !py-1.5" />
      </label>
      <a href={`/api/admin/orders/export?from=${from}&to=${to}`} className="btn-primary" download>
        <Download size={14} /> {t("CSV herunterladen", "Download CSV")}
      </a>
    </div>
  );
}
