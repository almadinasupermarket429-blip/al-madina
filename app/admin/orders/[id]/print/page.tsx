"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import { STORE } from "@/lib/store-info";
import { SUBSTITUTION_LABELS } from "@/lib/order-utils";

type Order = {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  fulfillment: "DELIVERY" | "PICKUP";
  address: string | null;
  notes: string | null;
  subtotal: number;
  discount: number;
  couponCode: string | null;
  deliveryFee: number;
  total: number;
  substitution: string;
  internalNote: string | null;
  status: string;
  slot: { date: string; start: string; end: string } | null;
  deliveryToken: string;
  createdAt: string;
  items: { id: string; name: string; sizeLabel: string | null; price: number; qty: number }[];
};

// Printable packing slip / delivery note. Always German — it goes in the bag.
export default function PackingSlipPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    fetch(`/api/orders/${params.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((o) => {
        setOrder(o);
        if (o) setTimeout(() => window.print(), 300);
      });
  }, [params.id]);

  if (order === undefined) return <p style={{ padding: 24 }}>Lädt…</p>;
  if (order === null) return <p style={{ padding: 24 }}>Bestellung nicht gefunden.</p>;

  const itemCount = order.items.reduce((s, i) => s + i.qty, 0);
  const slot = order.slot
    ? `${new Date(`${order.slot.date}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC" })}, ${order.slot.start}–${order.slot.end} Uhr`
    : null;

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 32, background: "#fff", color: "#111", fontFamily: "Arial, Helvetica, sans-serif", fontSize: 13 }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button className="btn-primary" onClick={() => window.print()}>
          <Printer size={14} /> Drucken
        </button>
      </div>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #111", paddingBottom: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{STORE.name}</div>
          <div dir="rtl" style={{ fontSize: 13 }}>{STORE.arabicName}</div>
          <div>
            {STORE.street}, {STORE.postalCode} {STORE.city} · Tel. {STORE.phoneDisplay}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>{order.fulfillment === "PICKUP" ? "Abholung" : "Lieferschein"}</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace" }}>#{order.orderNumber}</div>
          <div>{new Date(order.createdAt).toLocaleString("de-DE")}</div>
        </div>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, margin: "16px 0" }}>
        <div>
          <b>Kunde</b>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{order.customerName}</div>
          <div>{order.customerPhone}</div>
          <div>{order.customerEmail}</div>
          {order.fulfillment === "DELIVERY" && order.address && <div style={{ marginTop: 6, fontSize: 15 }}>{order.address}</div>}
        </div>
        <div>
          {slot && (
            <p style={{ margin: "0 0 6px" }}>
              <b>Zeitfenster:</b> {slot}
            </p>
          )}
          <p style={{ margin: "0 0 6px" }}>
            <b>Falls Artikel fehlt:</b> {SUBSTITUTION_LABELS[order.substitution]?.[0] ?? order.substitution}
          </p>
          {order.notes && (
            <p style={{ margin: "0 0 6px" }}>
              <b>Kundenhinweis:</b> {order.notes}
            </p>
          )}
          {order.internalNote && (
            <p style={{ margin: 0 }}>
              <b>Intern:</b> {order.internalNote}
            </p>
          )}
        </div>
      </section>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #111", textAlign: "left" }}>
            <th style={{ padding: "6px 4px", width: 28 }}>✓</th>
            <th style={{ padding: "6px 4px" }}>Artikel</th>
            <th style={{ padding: "6px 4px" }}>Größe</th>
            <th style={{ padding: "6px 4px", textAlign: "center" }}>Menge</th>
            <th style={{ padding: "6px 4px", textAlign: "right" }}>Einzel</th>
            <th style={{ padding: "6px 4px", textAlign: "right" }}>Summe</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((it) => (
            <tr key={it.id} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "8px 4px" }}>
                <span style={{ display: "inline-block", width: 14, height: 14, border: "1.5px solid #111" }} />
              </td>
              <td style={{ padding: "8px 4px", fontWeight: 600 }}>{it.name}</td>
              <td style={{ padding: "8px 4px" }}>{it.sizeLabel ?? "–"}</td>
              <td style={{ padding: "8px 4px", textAlign: "center", fontSize: 15, fontWeight: 700 }}>{it.qty}</td>
              <td style={{ padding: "8px 4px", textAlign: "right" }}>€{it.price.toFixed(2)}</td>
              <td style={{ padding: "8px 4px", textAlign: "right" }}>€{(it.price * it.qty).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
        <div>{itemCount} Artikel insgesamt</div>
        <table style={{ minWidth: 240 }}>
          <tbody>
            <tr>
              <td>Zwischensumme</td>
              <td style={{ textAlign: "right" }}>€{order.subtotal.toFixed(2)}</td>
            </tr>
            {order.discount > 0 && (
              <tr>
                <td>Rabatt {order.couponCode ? `(${order.couponCode})` : ""}</td>
                <td style={{ textAlign: "right" }}>−€{order.discount.toFixed(2)}</td>
              </tr>
            )}
            <tr>
              <td>{order.fulfillment === "PICKUP" ? "Abholung" : "Lieferung"}</td>
              <td style={{ textAlign: "right" }}>{order.deliveryFee ? `€${order.deliveryFee.toFixed(2)}` : "kostenlos"}</td>
            </tr>
            <tr style={{ fontSize: 17, fontWeight: 700 }}>
              <td style={{ paddingTop: 6, borderTop: "1px solid #111" }}>Bar zu kassieren</td>
              <td style={{ paddingTop: 6, borderTop: "1px solid #111", textAlign: "right" }}>€{order.total.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {order.fulfillment === "DELIVERY" && origin && (
        <p style={{ marginTop: 24, fontSize: 11, color: "#555" }}>
          Fahrer: nach Übergabe bestätigen unter {origin}/deliver/{order.deliveryToken}
        </p>
      )}
      <p style={{ marginTop: 24, fontSize: 11, color: "#555", textAlign: "center" }}>Vielen Dank für Ihren Einkauf bei {STORE.name}! · Mo–Sa 07:00–20:00 Uhr</p>
    </main>
  );
}
