"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Check, MapPin, Package, Phone, Store, Truck } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

type Order = {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  fulfillment: "DELIVERY" | "PICKUP";
  address: string | null;
  notes: string | null;
  total: number;
  status: string;
  items: { id: string; name: string; sizeLabel: string | null; qty: number }[];
};

export default function DeliverPage() {
  const { t } = useLanguage();
  const params = useParams<{ token: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/orders/deliver/${params.token}`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        setOrder(await res.json());
      })
      .catch(() => setError(t("Dieser Link ist ungültig oder die Bestellung wurde nicht gefunden.", "This link is invalid or the order could not be found.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.token]);

  async function confirm() {
    setConfirming(true);
    const res = await fetch(`/api/orders/deliver/${params.token}`, { method: "POST" });
    if (res.ok) {
      setOrder(await res.json());
      setDone(true);
    }
    setConfirming(false);
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f8f7f3] p-6 text-center">
        <p className="text-black/50">{error}</p>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f8f7f3]">
        <p className="text-black/40 text-sm">{t("Bestellung wird geladen…", "Loading order…")}</p>
      </main>
    );
  }

  const alreadyDelivered = order.status === "DELIVERED";

  return (
    <main className="min-h-screen bg-[#f8f7f3] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-black/5 p-6">
        <div className="flex items-center gap-2 mb-4">
          <img src="/logo.png" alt="Al-Madina" className="w-10 h-12 object-contain" />
          <div>
            <div className="font-serif text-lg leading-tight">Al-Madina Markt</div>
            <div className="text-xs text-black/40">
              {t("Bestellung", "Order")} #{order.orderNumber}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm font-semibold mb-3">
          <span className="flex shrink-0">{order.fulfillment === "PICKUP" ? <Store size={16} /> : <Truck size={16} />}</span>
          <span>{order.fulfillment === "PICKUP" ? t("Abholung im Laden", "Store pickup") : t("Lieferung nach Hause", "Home delivery")}</span>
        </div>

        <div className="text-sm space-y-1.5 mb-4">
          <div className="font-medium">{order.customerName}</div>
          <div className="flex items-center gap-1.5 text-black/60">
            <Phone size={13} /> {order.customerPhone}
          </div>
          {order.fulfillment === "DELIVERY" && order.address && (
            <div className="flex items-start gap-1.5 text-black/60">
              <MapPin size={13} className="mt-0.5" /> {order.address}
            </div>
          )}
          {order.notes && <div className="text-black/50 italic">&quot;{order.notes}&quot;</div>}
        </div>

        <div className="border-t border-black/5 pt-3 mb-4 text-sm">
          {order.items.map((it) => (
            <div key={it.id} className="flex justify-between py-1">
              <span>
                {it.name} {it.sizeLabel && <span className="text-black/40">· {it.sizeLabel}</span>}
              </span>
              <span className="text-black/50">×{it.qty}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center bg-[#f8f7f3] rounded-xl px-4 py-3 mb-5">
          <span className="text-sm font-medium">{t("Bargeld einsammeln", "Collect cash")}</span>
          <span className="text-xl font-serif">€{order.total.toFixed(2)}</span>
        </div>

        {order.status === "CANCELLED" ? (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-red-50 text-red-700 font-semibold py-3">
            {t("Diese Bestellung wurde storniert — nicht ausliefern.", "This order was cancelled — do not deliver.")}
          </div>
        ) : alreadyDelivered || done ? (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-green-50 text-green-700 font-semibold py-3">
            <Check size={17} />{" "}
            {order.fulfillment === "PICKUP" ? t("Als abgeholt markiert", "Marked as picked up") : t("Als zugestellt markiert", "Marked as delivered")}
          </div>
        ) : (
          <button
            onClick={confirm}
            disabled={confirming}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#a12e3d] to-[#7a1a26] text-white font-semibold py-3 disabled:opacity-60"
          >
            <Package size={16} />
            {confirming
              ? t("Wird bestätigt…", "Confirming…")
              : order.fulfillment === "PICKUP"
                ? t("Abholung durch Kunden bestätigen", "Confirm picked up by customer")
                : t("Zugestellt — Bargeld erhalten", "Confirm delivered — cash received")}
          </button>
        )}
      </div>
    </main>
  );
}
