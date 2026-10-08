"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RefreshCw, XCircle } from "lucide-react";
import OrderTimeline, { TrackableOrder } from "@/app/components/OrderTimeline";
import { useLanguage } from "@/lib/i18n";

export default function AccountOrderDetailPage() {
  const { t } = useLanguage();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<TrackableOrder | null | undefined>(undefined);
  const [reordering, setReordering] = useState(false);

  useEffect(() => {
    fetch(`/api/account/orders/${params.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setOrder);
  }, [params.id]);

  const [cancelError, setCancelError] = useState("");

  async function cancel() {
    if (!confirm(t("Diese Bestellung wirklich stornieren?", "Really cancel this order?"))) return;
    setCancelError("");
    const res = await fetch(`/api/account/orders/${params.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) setCancelError(data.error);
    else setOrder(data);
  }

  function reorder() {
    setReordering(true);
    router.push(`/?reorder=${params.id}`);
  }

  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#18201b]">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <Link href="/account" className="text-btn" style={{ display: "inline-flex", marginBottom: 24 }}>
          <ArrowLeft size={16} /> {t("Zurück zum Bestellverlauf", "Back to order history")}
        </Link>

        {order === undefined && <p>{t("Lädt…", "Loading…")}</p>}
        {order === null && <p>{t("Bestellung nicht gefunden.", "Order not found.")}</p>}

        {order && (
          <div className="checkout-modal" style={{ position: "static", boxShadow: "none", padding: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <span className="eyebrow">{t("Bestellung", "Order")}</span>
                <h1 style={{ fontSize: 26 }}>#{order.orderNumber}</h1>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {order.status === "PLACED" && (
                  <button className="outline-btn" onClick={cancel} style={{ color: "#b3261e" }}>
                    <XCircle size={16} /> {t("Stornieren", "Cancel")}
                  </button>
                )}
                <button className="primary-btn" onClick={reorder} disabled={reordering}>
                  <RefreshCw size={16} /> {t("Erneut bestellen", "Reorder")}
                </button>
              </div>
            </div>
            {cancelError && <div className="checkout-error" style={{ marginBottom: 16 }}>{cancelError}</div>}

            <OrderTimeline order={order} />
          </div>
        )}
      </div>
    </main>
  );
}
