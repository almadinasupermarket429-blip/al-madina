"use client";

import { useEffect, useMemo, useState } from "react";
import AdminShell from "../components/AdminShell";
import { Star, Trash2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

type Review = {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  createdAt: string;
  authorName: string;
  authorEmail: string;
  productName: string;
  productSlug: string;
};

export default function ReviewsPage() {
  const { t, language } = useLanguage();
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [filter, setFilter] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/admin/reviews")
      .then((res) => res.json())
      .then((data) => setReviews(Array.isArray(data) ? data : []));
  }, []);

  const shown = useMemo(() => (reviews ?? []).filter((r) => filter === null || r.rating === filter), [reviews, filter]);
  const average = reviews?.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  async function remove(r: Review) {
    if (!confirm(t("Diese Bewertung löschen?", "Delete this review?"))) return;
    const res = await fetch(`/api/reviews/${r.id}`, { method: "DELETE" });
    if (res.ok) setReviews((cur) => (cur ?? []).filter((x) => x.id !== r.id));
  }

  return (
    <AdminShell>
      <h1 className="font-serif text-3xl mb-1">{t("Bewertungen", "Reviews")}</h1>
      <p className="text-black/50 text-sm mb-6">
        {reviews?.length
          ? t(`${reviews.length} Bewertungen · Ø ${average.toFixed(1)} Sterne`, `${reviews.length} reviews · avg ${average.toFixed(1)} stars`)
          : t("Kundenbewertungen moderieren.", "Moderate customer reviews.")}
      </p>

      <div className="flex flex-wrap gap-2 mb-5">
        {[null, 5, 4, 3, 2, 1].map((n) => (
          <button
            key={String(n)}
            onClick={() => setFilter(n)}
            className={`px-3 py-1.5 rounded-full text-sm border ${filter === n ? "bg-[#a12e3d] text-white border-[#a12e3d]" : "bg-white border-black/10 text-black/60"}`}
          >
            {n === null ? t("Alle", "All") : `${n} ★`}
          </button>
        ))}
      </div>

      {reviews === null && <p className="text-black/40 text-sm">{t("Lädt…", "Loading…")}</p>}
      {reviews && shown.length === 0 && <div className="admin-card text-center text-black/40 py-10">{t("Keine Bewertungen.", "No reviews.")}</div>}

      <div className="grid gap-3">
        {shown.map((r) => (
          <div key={r.id} className={`admin-card flex gap-4 ${r.rating <= 2 ? "border-l-4 !border-l-red-300" : ""}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={14} fill={n <= r.rating ? "currentColor" : "none"} className="text-[#d99a2b]" />
                  ))}
                </span>
                <a href={`/products/${r.productSlug}`} target="_blank" rel="noreferrer" className="text-sm font-semibold hover:underline">
                  {r.productName}
                </a>
              </div>
              {r.title && <div className="font-medium mt-1">{r.title}</div>}
              {r.comment && <p className="text-sm text-black/70 mt-1 whitespace-pre-wrap">{r.comment}</p>}
              <div className="text-xs text-black/40 mt-2">
                {r.authorName} · {r.authorEmail} · {new Date(r.createdAt).toLocaleDateString(language === "de" ? "de-DE" : "en-GB")}
              </div>
            </div>
            <button className="btn-danger h-fit" onClick={() => remove(r)} aria-label={t("Bewertung löschen", "Delete review")}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
