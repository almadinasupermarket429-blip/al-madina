"use client";

import { Check, Package, Truck, ClipboardList, XCircle } from "lucide-react";
import { ORDER_STATUSES } from "@/lib/order-utils";
import { useLanguage } from "@/lib/i18n";

type StatusEvent = { status: string; createdAt: string };
export type TrackableOrder = {
  orderNumber: string;
  status: string;
  fulfillment: string;
  total: number;
  subtotal?: number;
  discount?: number;
  couponCode?: string | null;
  deliveryFee?: number;
  cancelReason?: string | null;
  slot?: { date: string; start: string; end: string } | null;
  createdAt: string;
  items: { id: string; name: string; sizeLabel: string | null; qty: number; price: number }[];
  statusEvents: StatusEvent[];
};

const STEP_ICON: Record<string, React.ComponentType<{ size?: number }>> = {
  PLACED: ClipboardList,
  PACKED: Package,
  OUT_FOR_DELIVERY: Truck,
  DELIVERED: Check,
};

const STEP_LABEL: Record<string, [string, string]> = {
  PLACED: ["Bestellt", "Order placed"],
  PACKED: ["Gepackt", "Packed"],
  OUT_FOR_DELIVERY: ["Unterwegs", "Out for delivery"],
  DELIVERED: ["Zugestellt", "Delivered"],
};

export default function OrderTimeline({ order }: { order: TrackableOrder }) {
  const { t } = useLanguage();
  // Pickup orders skip "out for delivery" — it doesn't apply.
  const steps: string[] = order.fulfillment === "PICKUP" ? ORDER_STATUSES.filter((s) => s !== "OUT_FOR_DELIVERY") : [...ORDER_STATUSES];
  const cancelled = order.status === "CANCELLED";
  const currentIdx = cancelled ? -1 : steps.indexOf(order.status);

  function timeFor(status: string) {
    return order.statusEvents.find((e) => e.status === status)?.createdAt;
  }

  return (
    <div>
      {cancelled && (
        <div className="checkout-error" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <XCircle size={18} />
          <span>
            {t("Diese Bestellung wurde storniert.", "This order was cancelled.")}
            {order.cancelReason ? ` (${order.cancelReason})` : ""}
          </span>
        </div>
      )}
      {order.slot && (
        <p style={{ fontSize: 14, marginBottom: 16 }}>
          <b>{t("Zeitfenster", "Time slot")}:</b>{" "}
          {new Date(`${order.slot.date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" })},{" "}
          {order.slot.start}–{order.slot.end}
        </p>
      )}
      <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 24, opacity: cancelled ? 0.4 : 1 }}>
        {steps.map((step, i) => {
          const Icon = STEP_ICON[step] ?? Check;
          const done = i <= currentIdx;
          const time = timeFor(step);
          const label = STEP_LABEL[step];
          return (
            <div key={step} style={{ flex: 1, textAlign: "center", position: "relative" }}>
              {i > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: 17,
                    left: "-50%",
                    width: "100%",
                    height: 2,
                    background: i <= currentIdx ? "#a12e3d" : "rgba(0,0,0,.1)",
                    zIndex: 0,
                  }}
                />
              )}
              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  margin: "0 auto 8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: done ? "#a12e3d" : "rgba(0,0,0,.06)",
                  color: done ? "#fff" : "rgba(0,0,0,.35)",
                }}
              >
                <Icon size={16} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: done ? "#18201b" : "rgba(24,32,27,.7)" }}>
                {label ? t(label[0], label[1]) : step}
              </div>
              {time && (
                <small style={{ color: "rgba(24,32,27,.7)" }}>
                  {new Date(time).toLocaleDateString()} {new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </small>
              )}
            </div>
          );
        })}
      </div>

      <ul style={{ fontSize: 14, marginBottom: 10 }}>
        {order.items.map((it) => (
          <li key={it.id}>
            {it.qty}× {it.name} {it.sizeLabel ? `(${it.sizeLabel})` : ""}
          </li>
        ))}
      </ul>
      {order.discount ? (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--green-text)" }}>
          <span>
            {t("Rabatt", "Discount")} {order.couponCode ? `(${order.couponCode})` : ""}
          </span>
          <span>−€{order.discount.toFixed(2)}</span>
        </div>
      ) : null}
      {order.deliveryFee ? (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
          <span>{t("Liefergebühr", "Delivery fee")}</span>
          <span>€{order.deliveryFee.toFixed(2)}</span>
        </div>
      ) : null}
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: "1px solid var(--line)", paddingTop: 6 }}>
        <span>{t("Gesamt (bar)", "Total (cash)")}</span>
        <span>€{order.total.toFixed(2)}</span>
      </div>
    </div>
  );
}
