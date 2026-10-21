"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "./components/AdminShell";
import {
  Check,
  ChevronRight,
  Copy,
  MapPin,
  Package,
  Phone,
  Store,
  Truck,
  Mail,
  Search,
  Download,
  Printer,
  XCircle,
  CalendarClock,
  Ticket,
  StickyNote,
  Repeat,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { SUBSTITUTION_LABELS } from "@/lib/order-utils";

type OrderItem = { id: string; name: string; sizeLabel: string | null; price: number; qty: number };
type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillment: "DELIVERY" | "PICKUP";
  address: string | null;
  notes: string | null;
  subtotal: number;
  discount: number;
  couponCode: string | null;
  deliveryFee: number;
  total: number;
  substitution: string;
  cancelReason: string | null;
  internalNote: string | null;
  slot: { date: string; start: string; end: string } | null;
  status: "PLACED" | "PACKED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";
  deliveryToken: string;
  createdAt: string;
  items: OrderItem[];
};

const TABS: { key: string; label: [string, string] }[] = [
  { key: "ACTIVE", label: ["Aktiv", "Active"] },
  { key: "PLACED", label: ["Neu", "New"] },
  { key: "PACKED", label: ["Gepackt", "Packed"] },
  { key: "OUT_FOR_DELIVERY", label: ["Unterwegs", "Out for delivery"] },
  { key: "DELIVERED", label: ["Abgeschlossen", "Completed"] },
  { key: "CANCELLED", label: ["Storniert", "Cancelled"] },
  { key: "ALL", label: ["Alle", "All"] },
];

const STATUS_STYLES: Record<string, string> = {
  PLACED: "bg-amber-100 text-amber-800",
  PACKED: "bg-blue-100 text-blue-800",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<string, [string, string]> = {
  PLACED: ["Neu", "New"],
  PACKED: ["Gepackt", "Packed"],
  OUT_FOR_DELIVERY: ["Unterwegs", "Out for delivery"],
  DELIVERED: ["Zugestellt", "Delivered"],
  CANCELLED: ["Storniert", "Cancelled"],
};

function formatSlot(slot: Order["slot"], language: string) {
  if (!slot) return "";
  const d = new Date(`${slot.date}T12:00:00Z`).toLocaleDateString(language === "de" ? "de-DE" : "en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
  return `${d}, ${slot.start}–${slot.end}`;
}

export default function AdminOrdersPage() {
  const { t } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState("ACTIVE");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [acceptingOrders, setAcceptingOrders] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  // Search + date range go to the server (so CSV export matches); tab filtering is local for instant switching.
  const serverParams = useMemo(() => {
    const p = new URLSearchParams();
    if (query.trim()) p.set("q", query.trim());
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p.toString();
  }, [query, from, to]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/orders?${serverParams}`);
    if (res.ok) setOrders(await res.json());
    setLoading(false);
  }, [serverParams]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const onChange = () => load();
    window.addEventListener("almadina:new-order", onChange);
    window.addEventListener("almadina:order-updated", onChange);
    return () => {
      window.removeEventListener("almadina:new-order", onChange);
      window.removeEventListener("almadina:order-updated", onChange);
    };
  }, [load]);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((s) => s && setAcceptingOrders(s.acceptingOrders));
  }, []);

  async function toggleAccepting() {
    const next = !acceptingOrders;
    setAcceptingOrders(next);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acceptingOrders: next }),
    });
    if (!res.ok) setAcceptingOrders(!next);
  }

  const filtered = useMemo(() => {
    if (tab === "ALL") return orders;
    if (tab === "ACTIVE") return orders.filter((o) => o.status !== "DELIVERED" && o.status !== "CANCELLED");
    return orders.filter((o) => o.status === tab);
  }, [orders, tab]);

  async function patchOrder(order: Order, body: Record<string, unknown>, optimistic?: Partial<Order>) {
    setError("");
    if (optimistic) setOrders((cur) => cur.map((o) => (o.id === order.id ? { ...o, ...optimistic } : o)));
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setOrders((cur) => cur.map((o) => (o.id === order.id ? updated : o)));
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || t("Aktion fehlgeschlagen.", "Action failed."));
      load();
    }
  }

  const todayCount = orders.filter((o) => new Date(o.createdAt).toDateString() === new Date().toDateString() && o.status !== "CANCELLED");
  const todayRevenue = todayCount.reduce((s, o) => s + o.total, 0);

  return (
    <AdminShell>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="font-serif text-3xl">{t("Bestellungen", "Orders")}</h1>
          <p className="text-black/50 text-sm mt-1">
            {t("Barzahlung bei Lieferung/Abholung — es wird keine Online-Zahlung verarbeitet.", "Cash on delivery / pickup — no online payment is processed.")}
          </p>
        </div>
        {acceptingOrders !== null && (
          <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${acceptingOrders ? "bg-white border-black/5" : "bg-red-50 border-red-200"}`}>
            <div className="text-sm">
              <div className="font-semibold">{acceptingOrders ? t("Online-Bestellungen: AN", "Online orders: ON") : t("Online-Bestellungen: PAUSIERT", "Online orders: PAUSED")}</div>
              <div className="text-xs text-black/50">{t("z. B. bei Hochbetrieb kurz pausieren", "Pause briefly when it's too busy")}</div>
            </div>
            <button
              role="switch"
              aria-checked={acceptingOrders}
              aria-label={t("Online-Bestellungen annehmen", "Accept online orders")}
              className="admin-switch"
              onClick={toggleAccepting}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label={t("Heute", "Today")} value={String(todayCount.length)} />
        <Stat label={t("Umsatz heute", "Revenue today")} value={`€${todayRevenue.toFixed(2)}`} />
        <Stat label={t("Neu", "New")} value={String(orders.filter((o) => o.status === "PLACED").length)} highlight />
        <Stat label={t("Zu packen / unterwegs", "To pack / en route")} value={String(orders.filter((o) => o.status === "PACKED" || o.status === "OUT_FOR_DELIVERY").length)} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <div className="flex items-center gap-2 bg-white border border-black/10 rounded-full px-3 py-2 flex-1 min-w-[220px]">
          <Search size={15} className="text-black/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Bestellnr., Name, E-Mail oder Telefon…", "Order no., name, email or phone…")}
            className="w-full text-sm outline-none bg-transparent"
            aria-label={t("Bestellungen durchsuchen", "Search orders")}
          />
        </div>
        <label className="flex items-center gap-1 text-xs text-black/50">
          {t("Von", "From")}
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input !w-auto !py-1.5" />
        </label>
        <label className="flex items-center gap-1 text-xs text-black/50">
          {t("Bis", "To")}
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input !w-auto !py-1.5" />
        </label>
        <a href={`/api/orders?${serverParams}${serverParams ? "&" : ""}format=csv`} className="btn-outline">
          <Download size={14} /> CSV
        </a>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0 scroll-x-hide">
        {TABS.map((tabDef) => (
          <button
            key={tabDef.key}
            onClick={() => setTab(tabDef.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium border shrink-0 whitespace-nowrap ${
              tab === tabDef.key ? "bg-[#a12e3d] text-white border-[#a12e3d]" : "border-black/10 text-black/60 bg-white"
            }`}
          >
            {t(tabDef.label[0], tabDef.label[1])}
            {["PLACED", "PACKED", "OUT_FOR_DELIVERY"].includes(tabDef.key) && (
              <span className="ml-1.5 text-xs opacity-70">{orders.filter((o) => o.status === tabDef.key).length}</span>
            )}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}
      {loading && <div className="text-black/40 text-sm">{t("Bestellungen werden geladen…", "Loading orders…")}</div>}
      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-black/5 p-12 text-center text-black/40">{t("Keine Bestellungen gefunden.", "No orders found.")}</div>
      )}

      <div className="grid gap-4">
        {filtered.map((order) => (
          <OrderCard key={order.id} order={order} onPatch={patchOrder} />
        ))}
      </div>
    </AdminShell>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "bg-amber-50 border-amber-200" : "bg-white border-black/5"}`}>
      <div className="text-[11px] uppercase tracking-wide text-black/50">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function OrderCard({
  order,
  onPatch,
}: {
  order: Order;
  onPatch: (o: Order, body: Record<string, unknown>, optimistic?: Partial<Order>) => void;
}) {
  const { t, language } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(order.internalNote ?? "");
  const deliverUrl = typeof window !== "undefined" ? `${window.location.origin}/deliver/${order.deliveryToken}` : "";

  function copyLink() {
    navigator.clipboard.writeText(deliverUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function advance(status: string) {
    onPatch(order, { status }, { status: status as Order["status"] });
  }

  function cancel() {
    const reason = prompt(
      t(
        "Bestellung stornieren? Die Artikel werden wieder dem Lager gutgeschrieben.\n\nGrund (optional, wird dem Kunden gemailt):",
        "Cancel this order? Items go back into stock.\n\nReason (optional, emailed to the customer):"
      )
    );
    if (reason === null) return;
    onPatch(order, { status: "CANCELLED", reason });
  }

  function saveNote() {
    onPatch(order, { internalNote: note });
    setNoteOpen(false);
  }

  const statusLabel = STATUS_LABEL[order.status];
  const sub = SUBSTITUTION_LABELS[order.substitution];
  const cancellable = order.status === "PLACED" || order.status === "PACKED";

  return (
    <div className={`bg-white rounded-2xl border p-5 ${order.status === "PLACED" ? "border-amber-300" : "border-black/5"} ${order.status === "CANCELLED" ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold">#{order.orderNumber}</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[order.status]}`}>
              {statusLabel ? t(statusLabel[0], statusLabel[1]) : order.status}
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-black/5 text-black/60 flex items-center gap-1">
              <span className="flex shrink-0">{order.fulfillment === "PICKUP" ? <Store size={11} /> : <Truck size={11} />}</span>
              <span>{order.fulfillment === "PICKUP" ? t("Abholung", "Pickup") : t("Lieferung", "Delivery")}</span>
            </span>
            {order.slot && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#a12e3d]/10 text-[#a12e3d] flex items-center gap-1">
                <CalendarClock size={11} /> {formatSlot(order.slot, language)}
              </span>
            )}
          </div>
          <div className="text-xs text-black/40 mt-1">{new Date(order.createdAt).toLocaleString(language === "de" ? "de-DE" : "en-GB")}</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-serif font-medium">€{order.total.toFixed(2)}</div>
          <div className="text-[11px] text-black/40">
            {order.fulfillment === "PICKUP" ? t("bar bei Abholung", "cash on pickup") : t("bar bei Lieferung", "cash on delivery")}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_1.2fr] gap-5">
        <div className="text-sm space-y-1.5">
          <div className="font-semibold">{order.customerName}</div>
          {order.customerEmail ? (
            <>
              <a href={`tel:${order.customerPhone.replace(/\s/g, "")}`} className="flex items-center gap-1.5 text-black/60 hover:text-[#a12e3d]">
                <Phone size={13} /> {order.customerPhone}
              </a>
              <div className="flex items-start gap-1.5 text-black/60">
                <Mail size={13} className="mt-0.5 shrink-0" /> <span className="break-all">{order.customerEmail}</span>
              </div>
            </>
          ) : (
            <div className="text-black/40 italic">{t("Kontaktdaten entfernt (Datenschutz)", "Contact details removed (privacy)")}</div>
          )}
          {order.fulfillment === "DELIVERY" && order.address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-start gap-1.5 text-black/60 hover:text-[#a12e3d]"
            >
              <MapPin size={13} className="mt-0.5 shrink-0" /> {order.address}
            </a>
          )}
          {sub && (
            <div className="flex items-start gap-1.5 text-black/60">
              <Repeat size={13} className="mt-0.5 shrink-0" /> {t("Falls nicht da:", "If unavailable:")} {t(sub[0], sub[1])}
            </div>
          )}
          {order.notes && <div className="text-black/50 italic mt-1">“{order.notes}”</div>}
          {order.cancelReason && <div className="text-red-700 text-xs mt-1">{t("Stornogrund:", "Cancel reason:")} {order.cancelReason}</div>}
        </div>

        <div>
          <table className="w-full text-sm">
            <tbody>
              {order.items.map((it) => (
                <tr key={it.id} className="border-b border-black/5 last:border-0">
                  <td className="py-1.5">
                    {it.name} {it.sizeLabel && <span className="text-black/40">· {it.sizeLabel}</span>}
                  </td>
                  <td className="py-1.5 text-center text-black/50">×{it.qty}</td>
                  <td className="py-1.5 text-right">€{(it.price * it.qty).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-xs text-black/50 mt-2 space-y-0.5 text-right">
            {order.discount > 0 && (
              <div className="text-green-700 flex items-center justify-end gap-1">
                <Ticket size={12} /> {order.couponCode} −€{order.discount.toFixed(2)}
              </div>
            )}
            {order.deliveryFee > 0 && (
              <div>
                {t("Liefergebühr", "Delivery fee")} €{order.deliveryFee.toFixed(2)}
              </div>
            )}
          </div>
        </div>
      </div>

      {(order.internalNote || noteOpen) && (
        <div className="mt-3 rounded-xl bg-yellow-50 border border-yellow-200 p-3 text-sm">
          {noteOpen ? (
            <div className="grid gap-2">
              <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Interne Notiz (nur für Mitarbeiter sichtbar)", "Internal note (staff only)")} />
              <div className="flex gap-2">
                <button className="btn-primary" onClick={saveNote}>
                  {t("Speichern", "Save")}
                </button>
                <button className="btn-outline" onClick={() => setNoteOpen(false)}>
                  {t("Abbrechen", "Cancel")}
                </button>
              </div>
            </div>
          ) : (
            <button className="text-left w-full flex gap-2" onClick={() => setNoteOpen(true)}>
              <StickyNote size={14} className="mt-0.5 shrink-0 text-yellow-700" /> {order.internalNote}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-black/5">
        {order.status === "PLACED" && (
          <button onClick={() => advance("PACKED")} className="btn-primary">
            <Package size={14} /> {t("Als gepackt markieren", "Mark packed")} <ChevronRight size={14} />
          </button>
        )}
        {order.status === "PACKED" && order.fulfillment === "DELIVERY" && (
          <button onClick={() => advance("OUT_FOR_DELIVERY")} className="btn-primary">
            <Truck size={14} /> {t("Als unterwegs markieren", "Mark out for delivery")} <ChevronRight size={14} />
          </button>
        )}
        {order.status === "PACKED" && order.fulfillment === "PICKUP" && (
          <span className="text-xs text-black/50 bg-black/5 rounded-full px-3 py-2">
            {t("Bereit zur Abholung — der Kunde wurde per E-Mail informiert.", "Ready for pickup — the customer was emailed.")}
          </span>
        )}
        {(order.status === "OUT_FOR_DELIVERY" || (order.status === "PACKED" && order.fulfillment === "PICKUP")) && (
          <>
            <button onClick={copyLink} className="btn-outline">
              <Copy size={14} />{" "}
              {copied
                ? t("Link kopiert!", "Link copied!")
                : order.fulfillment === "PICKUP"
                  ? t("Abholungs-Link kopieren", "Copy pickup-confirm link")
                  : t("Lieferlink kopieren", "Copy delivery link")}
            </button>
            <button onClick={() => advance("DELIVERED")} className="btn-outline">
              <Check size={14} />{" "}
              {order.fulfillment === "PICKUP" ? t("Als abgeholt markieren", "Mark picked up") : t("Als zugestellt markieren", "Mark delivered")}
            </button>
          </>
        )}
        {order.status === "DELIVERED" && (
          <span className="text-xs text-green-700 bg-green-50 rounded-full px-3 py-2 flex items-center gap-1">
            <Check size={13} /> {order.fulfillment === "PICKUP" ? t("Abgeholt", "Picked up") : t("Zugestellt", "Delivered")}
          </span>
        )}

        <div className="ml-auto flex flex-wrap gap-2">
          <a href={`/admin/orders/${order.id}/print`} target="_blank" rel="noreferrer" className="btn-outline">
            <Printer size={14} /> {t("Packzettel", "Packing slip")}
          </a>
          {!order.internalNote && !noteOpen && (
            <button onClick={() => setNoteOpen(true)} className="btn-outline">
              <StickyNote size={14} /> {t("Notiz", "Note")}
            </button>
          )}
          {cancellable && (
            <button onClick={cancel} className="btn-danger">
              <XCircle size={14} /> {t("Stornieren", "Cancel")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
