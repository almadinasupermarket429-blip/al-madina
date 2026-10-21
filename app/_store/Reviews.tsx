"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Star } from "lucide-react";
import { StarRating } from "@/app/components/StarRating";
import type { Account, ReviewData, Translate } from "./types";

type Summary = { average: number; count: number };

/** Loads a product's reviews; also reports the latest average/count so the header can update. */
export function useReviews(productId: string, initial: Summary) {
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [summary, setSummary] = useState<Summary>(initial);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    fetch(`/api/reviews?productId=${productId}`)
      .then((res) => res.json())
      .then((data) => {
        setReviews(data.reviews ?? []);
        setSummary({ average: data.average ?? 0, count: data.count ?? 0 });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [productId]);

  useEffect(reload, [reload]);
  return { reviews, summary, loading, reload };
}

type Props = {
  productId: string;
  account: Account | null;
  reviews: ReviewData[];
  loading: boolean;
  onSubmitted: () => void;
  t: Translate;
};

export function Reviews({ productId, account, reviews, loading, onSubmitted, t }: Props) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, rating, title, comment }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("Bewertung konnte nicht gespeichert werden.", "Could not save your review."));
      } else {
        setSubmitted(true);
        setTitle("");
        setComment("");
        onSubmitted();
      }
    } catch {
      setError(t("Verbindungsfehler. Bitte versuchen Sie es erneut.", "Connection error. Please try again."));
    }
    setSubmitting(false);
  }

  return (
    <>
      <h3 style={{ fontSize: 18, marginBottom: 10 }}>{t("Bewertungen", "Reviews")}</h3>

      {!account ? (
        <p style={{ marginBottom: 20 }}>
          <Link href="/account" style={{ textDecoration: "underline" }}>
            {t("Melden Sie sich an", "Sign in")}
          </Link>{" "}
          {t("um eine Bewertung zu hinterlassen.", "to leave a review.")}
        </p>
      ) : submitted ? (
        <p style={{ color: "rgba(24,32,27,.7)" }}>
          <Check size={15} style={{ display: "inline", marginRight: 4 }} />
          {t("Danke für Ihre Bewertung!", "Thanks for your review!")}
        </p>
      ) : (
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 4 }} role="radiogroup" aria-label={t("Bewertung", "Rating")}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={n === rating}
                onClick={() => setRating(n)}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                aria-label={`${n} ${t(n === 1 ? "Stern" : "Sterne", n === 1 ? "star" : "stars")}`}
              >
                <Star size={22} fill={n <= rating ? "currentColor" : "none"} style={{ color: "#d99a2b" }} />
              </button>
            ))}
          </div>
          <input placeholder={t("Titel (optional)", "Title (optional)")} value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea placeholder={t("Ihre Bewertung (optional)", "Your review (optional)")} value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
          {error && <div className="checkout-error">{error}</div>}
          <button className="primary-btn" disabled={submitting}>
            {submitting ? t("Wird gesendet…", "Submitting…") : t("Bewertung abgeben", "Submit review")}
          </button>
        </form>
      )}

      {loading && <div className="empty">{t("Bewertungen werden geladen…", "Loading reviews…")}</div>}
      {!loading && reviews.length === 0 && (
        <p style={{ color: "rgba(24,32,27,.7)" }}>{t("Seien Sie der Erste, der dieses Produkt bewertet.", "Be the first to review this product.")}</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {reviews.map((r) => (
          <div key={r.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StarRating value={r.rating} size={13} />
              <b style={{ fontSize: 14 }}>{r.title || r.authorName}</b>
            </div>
            {r.comment && <p style={{ fontSize: 14, marginTop: 4 }}>{r.comment}</p>}
            <small style={{ color: "rgba(24,32,27,.7)" }}>
              {r.authorName} · {new Date(r.createdAt).toLocaleDateString()}
            </small>
          </div>
        ))}
      </div>
    </>
  );
}
