"use client";

import { useCallback, useEffect, useState } from "react";
import { History, Search } from "lucide-react";
import AdminShell from "../components/AdminShell";
import { useLanguage } from "@/lib/i18n";

type Entry = { id: string; createdAt: string; actor: string; action: string; entity: string; entityId: string | null; summary: string };

const FILTERS: [string, string, string][] = [
  ["", "Alle", "All"],
  ["product", "Produkte", "Products"],
  ["variant", "Preise & Bestand", "Prices & stock"],
  ["order", "Bestellungen", "Orders"],
  ["customer", "Kunden", "Customers"],
  ["coupon", "Gutscheine", "Coupons"],
  ["settings", "Einstellungen", "Settings"],
  ["team", "Team", "Team"],
];

/** Who changed what, and when — every admin change is listed here, newest first. */
export default function ActivityPage() {
  const { t, language } = useLanguage();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [entity, setEntity] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (before?: string) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (entity) params.set("entity", entity);
      if (q.trim()) params.set("q", q.trim());
      if (before) params.set("before", before);
      const res = await fetch(`/api/admin/activity?${params}`);
      const data = res.ok ? await res.json() : { entries: [], hasMore: false };
      setEntries((cur) => (before ? [...cur, ...data.entries] : data.entries));
      setHasMore(data.hasMore);
      setLoading(false);
    },
    [entity, q]
  );

  useEffect(() => {
    const timer = setTimeout(() => load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  const locale = language === "de" ? "de-DE" : "en-GB";

  return (
    <AdminShell>
      <h1 className="font-serif text-3xl mb-1 flex items-center gap-2">
        <History size={26} /> {t("Aktivitätsprotokoll", "Activity log")}
      </h1>
      <p className="text-black/50 text-sm mb-6">
        {t("Jede Änderung in der Verwaltung — wer, was und wann. Einträge werden nach 2 Jahren gelöscht.", "Every change made in the admin — who, what and when. Entries are deleted after 2 years.")}
      </p>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <div className="flex items-center gap-2 bg-white border border-black/10 rounded-full px-3 py-2 flex-1 min-w-[200px] max-w-md">
          <Search size={15} className="text-black/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("Suchen (Produkt, Bestellnummer, Person)…", "Search (product, order number, person)…")}
            className="w-full text-sm outline-none bg-transparent"
            aria-label={t("Protokoll durchsuchen", "Search the log")}
          />
        </div>
        {FILTERS.map(([key, de, en]) => (
          <button
            key={key || "all"}
            onClick={() => setEntity(key)}
            className={`px-3 py-1.5 rounded-full text-sm border ${entity === key ? "bg-[#a12e3d] text-white border-[#a12e3d]" : "bg-white border-black/10 text-black/60"}`}
          >
            {t(de, en)}
          </button>
        ))}
      </div>

      <div className="admin-card overflow-x-auto !p-2">
        <table className="admin-table min-w-[640px]">
          <thead>
            <tr>
              <th>{t("Zeitpunkt", "When")}</th>
              <th>{t("Wer", "Who")}</th>
              <th>{t("Was", "What")}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap text-black/60">{new Date(e.createdAt).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</td>
                <td className="text-black/70">{e.actor}</td>
                <td>{e.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && entries.length === 0 && <p className="text-center text-black/40 text-sm py-8">{t("Noch keine Einträge.", "No entries yet.")}</p>}
        {loading && <p className="text-center text-black/40 text-sm py-4">{t("Wird geladen…", "Loading…")}</p>}
      </div>
      {hasMore && !loading && (
        <div className="flex justify-center mt-4">
          <button className="btn-outline" onClick={() => load(entries[entries.length - 1]?.id)}>
            {t("Ältere Einträge laden", "Load older entries")}
          </button>
        </div>
      )}
    </AdminShell>
  );
}
