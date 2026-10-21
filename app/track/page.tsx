"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import OrderTimeline, { TrackableOrder } from "@/app/components/OrderTimeline";
import { useLanguage } from "@/lib/i18n";

export default function TrackOrderPage() {
  const { t } = useLanguage();
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<TrackableOrder | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOrder(null);
    setLoading(true);
    try {
      const res = await fetch("/api/orders/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("Diese Bestellung konnte nicht gefunden werden.", "Could not find that order."));
      } else {
        setOrder(data);
      }
    } catch {
      setError(t("Verbindungsfehler. Bitte versuchen Sie es erneut.", "Connection error. Please try again."));
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#18201b] flex flex-col items-center py-12 px-4 md:px-8">
      <div className="w-full max-w-xl bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-black/5">
        <Link href="/" className="text-btn" style={{ display: "inline-flex", marginBottom: 24 }}>
          <ArrowLeft size={16} /> {t("Zurück zum Shop", "Back to shop")}
        </Link>

        <span className="eyebrow block mb-1">{t("Bestellverfolgung", "Order tracking")}</span>
        <h1 style={{ fontSize: 30, marginBottom: 24 }}>{t("Bestellung verfolgen", "Track your order")}</h1>

        {!order && (
          <form onSubmit={submit} className="checkout-fields">
            <input
              required
              placeholder={t("Bestellnummer (z. B. AM-20260905-4F2K)", "Order number (e.g. AM-20260905-4F2K)")}
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              className="w-full mb-3 rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-[#a12e3d]"
            />
            <input
              required
              type="email"
              placeholder={t("E-Mail von der Bestellung", "Email used at checkout")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mb-4 rounded-lg border border-black/10 px-3 py-2 outline-none focus:border-[#a12e3d]"
            />
            {error && <div className="checkout-error mb-4">{error}</div>}
            <button className="primary-btn full w-full flex justify-center items-center gap-2 py-2.5 rounded-lg bg-[#a12e3d] text-white" disabled={loading}>
              <Search size={16} /> {loading ? t("Suche läuft…", "Searching…") : t("Bestellung verfolgen", "Track order")}
            </button>
          </form>
        )}

        {order && (
          <div>
            <h2 style={{ fontSize: 22, marginBottom: 16 }}>#{order.orderNumber}</h2>
            <OrderTimeline order={order} />
            {order.status !== "CANCELLED" && (
              <p style={{ marginTop: 20, fontSize: 13, color: "rgba(24,32,27,.6)" }}>
                {order.status === "PLACED" || order.status === "PACKED"
                  ? t("Noch nicht unterwegs? Sie können die Bestellung jetzt noch stornieren: ", "Not on its way yet? You can still cancel the order: ")
                  : t("Sie möchten vom Kauf zurücktreten? ", "Want to withdraw from this purchase? ")}
                <a href={`/widerruf?order=${encodeURIComponent(order.orderNumber)}`} style={{ color: "#a12e3d", fontWeight: 700, textDecoration: "underline" }}>
                  {t("Vertrag widerrufen", "Withdraw from contract")}
                </a>
              </p>
            )}
            <button className="text-btn mt-6 font-medium text-[#a12e3d]" onClick={() => setOrder(null)}>
              {t("Andere Bestellung verfolgen", "Track another order")}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
