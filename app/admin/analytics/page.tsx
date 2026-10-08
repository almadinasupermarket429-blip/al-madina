"use client";

import { useEffect, useState } from "react";
import AdminShell from "../components/AdminShell";
import { AlertTriangle, TrendingUp, TrendingDown, Package, Receipt, Users, XCircle, Ticket, Store, Truck } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

type Analytics = {
  days: number;
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  previous: { revenue: number; orders: number; averageOrderValue: number };
  newCustomers: number;
  cancelledOrders: number;
  totalDiscount: number;
  ordersByStatus: { status: string; count: number }[];
  revenueByDay: { date: string; revenue: number; orders: number }[];
  ordersByHour: number[];
  ordersByWeekday: { orders: number; revenue: number }[];
  fulfillment: { DELIVERY: { orders: number; revenue: number }; PICKUP: { orders: number; revenue: number } };
  coupons: { code: string; uses: number; discount: number }[];
  topProducts: { name: string; qty: number; revenue: number }[];
  lowStock: { id: string; productName: string; sizeLabel: string; stock: number }[];
};

const WEEKDAYS: [string, string][] = [
  ["So", "Sun"],
  ["Mo", "Mon"],
  ["Di", "Tue"],
  ["Mi", "Wed"],
  ["Do", "Thu"],
  ["Fr", "Fri"],
  ["Sa", "Sat"],
];

function money(n: number) {
  return `€${n.toFixed(2)}`;
}

function change(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export default function AnalyticsPage() {
  const { t, language } = useLanguage();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    setData(null);
    fetch(`/api/admin/analytics?days=${days}`)
      .then((res) => res.json())
      .then(setData);
  }, [days]);

  const rangeTabs = (
    <div className="flex gap-2">
      {[7, 30, 90].map((d) => (
        <button
          key={d}
          onClick={() => setDays(d)}
          className={`px-3 py-1.5 rounded-full text-sm border ${days === d ? "bg-[#a12e3d] text-white border-[#a12e3d]" : "bg-white border-black/10 text-black/60"}`}
        >
          {t(`${d} Tage`, `${d} days`)}
        </button>
      ))}
    </div>
  );

  if (!data)
    return (
      <AdminShell>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-3xl font-serif">{t("Analyse", "Analytics")}</h1>
          {rangeTabs}
        </div>
        <p className="text-black/40 text-sm">{t("Lädt…", "Loading…")}</p>
      </AdminShell>
    );

  const maxDayRevenue = Math.max(1, ...data.revenueByDay.map((d) => d.revenue));
  const maxHour = Math.max(1, ...data.ordersByHour);
  const maxWeekday = Math.max(1, ...data.ordersByWeekday.map((d) => d.orders));
  const fulfillTotal = data.fulfillment.DELIVERY.orders + data.fulfillment.PICKUP.orders;
  const deliveryShare = fulfillTotal ? (data.fulfillment.DELIVERY.orders / fulfillTotal) * 100 : 0;
  const locale = language === "de" ? "de-DE" : "en-GB";

  return (
    <AdminShell>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-3xl font-serif">{t("Analyse", "Analytics")}</h1>
        {rangeTabs}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Kpi icon={Receipt} label={t("Umsatz", "Revenue")} value={money(data.totalRevenue)} delta={change(data.totalRevenue, data.previous.revenue)} t={t} />
        <Kpi icon={TrendingUp} label={t("Bestellungen", "Orders")} value={String(data.totalOrders)} delta={change(data.totalOrders, data.previous.orders)} t={t} />
        <Kpi
          icon={Package}
          label={t("Ø Bestellwert", "Avg. order value")}
          value={money(data.averageOrderValue)}
          delta={change(data.averageOrderValue, data.previous.averageOrderValue)}
          t={t}
        />
        <Kpi icon={Users} label={t("Neue Kunden", "New customers")} value={String(data.newCustomers)} t={t} />
        <Kpi icon={XCircle} label={t("Stornierungen", "Cancellations")} value={String(data.cancelledOrders)} t={t} />
        <Kpi icon={Ticket} label={t("Gewährte Rabatte", "Discounts given")} value={money(data.totalDiscount)} t={t} />
        <div className="bg-white rounded-xl border border-black/5 p-5 col-span-2">
          <div className="text-black/50 text-xs uppercase tracking-wide mb-3">{t("Lieferung vs. Abholung", "Delivery vs. pickup")}</div>
          <div className="h-3 rounded-full bg-[#e3b23c]/40 overflow-hidden flex">
            <div className="h-full bg-[#a12e3d]" style={{ width: `${deliveryShare}%` }} />
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="flex items-center gap-1">
              <Truck size={14} className="text-[#a12e3d]" /> {data.fulfillment.DELIVERY.orders} · {money(data.fulfillment.DELIVERY.revenue)}
            </span>
            <span className="flex items-center gap-1">
              <Store size={14} className="text-[#b08a1e]" /> {data.fulfillment.PICKUP.orders} · {money(data.fulfillment.PICKUP.revenue)}
            </span>
          </div>
        </div>
      </div>

      {data.lowStock.length > 0 && (
        <div className="bg-[#fff3ee] border border-[#e0a98c] rounded-xl p-5 mb-8">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 font-semibold text-[#a12e3d]">
              <AlertTriangle size={16} /> {t("Niedriger Bestand — nachbestellen", "Low stock — reorder")}
            </div>
            <a href="/admin/products" className="text-xs font-semibold text-[#a12e3d] underline">
              {t("Bestand bearbeiten", "Edit stock")}
            </a>
          </div>
          <ul className="text-sm space-y-1">
            {data.lowStock.map((s) => (
              <li key={s.id} className="flex justify-between">
                <span>
                  {s.productName} <span className="text-black/50">({s.sizeLabel})</span>
                </span>
                <span className={`font-semibold ${s.stock === 0 ? "text-red-700" : ""}`}>{s.stock === 0 ? t("ausverkauft", "sold out") : t(`Noch ${s.stock}`, `${s.stock} left`)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-xl border border-black/5 p-5 mb-8">
        <h2 className="font-semibold mb-4">{t(`Umsatz pro Tag, letzte ${data.days} Tage`, `Revenue per day, last ${data.days} days`)}</h2>
        <div className="flex items-end gap-[2px] h-40">
          {data.revenueByDay.map((d) => (
            <div key={d.date} className="flex-1 h-full flex flex-col justify-end group relative">
              <div
                className={`w-full rounded-t ${d.revenue > 0 ? "bg-[#a12e3d]/75 group-hover:bg-[#a12e3d]" : "bg-black/5"}`}
                style={{ height: `${d.revenue > 0 ? Math.max(4, (d.revenue / maxDayRevenue) * 100) : 2}%` }}
                title={`${new Date(`${d.date}T12:00:00Z`).toLocaleDateString(locale, { timeZone: "UTC" })}: ${money(d.revenue)} · ${t(`${d.orders} Bestellungen`, `${d.orders} orders`)}`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[11px] text-black/40 mt-2">
          <span>{new Date(`${data.revenueByDay[0]?.date}T12:00:00Z`).toLocaleDateString(locale, { timeZone: "UTC" })}</span>
          <span>{t("heute", "today")}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-black/5 p-5">
          <h2 className="font-semibold mb-1">{t("Stoßzeiten", "Peak hours")}</h2>
          <p className="text-xs text-black/50 mb-4">{t("Bestellungen nach Uhrzeit — hilft bei der Personalplanung.", "Orders by time of day — useful for staffing.")}</p>
          <div className="flex items-end gap-[2px] h-28">
            {data.ordersByHour.map((n, h) => (
              <div key={h} className="flex-1 h-full flex flex-col justify-end">
                <div className={`w-full rounded-t ${n ? "bg-[#4f9d5f]" : "bg-black/5"}`} style={{ height: `${n ? Math.max(6, (n / maxHour) * 100) : 2}%` }} title={`${h}:00 — ${n}`} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-black/40 mt-1">
            <span>0:00</span>
            <span>6:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:00</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-black/5 p-5">
          <h2 className="font-semibold mb-4">{t("Bestellungen nach Wochentag", "Orders by weekday")}</h2>
          <div className="grid gap-2">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <div key={d} className="flex items-center gap-3 text-sm">
                <span className="w-8 text-black/60">{t(WEEKDAYS[d][0], WEEKDAYS[d][1])}</span>
                <div className="flex-1 h-4 bg-black/5 rounded">
                  <div className="h-full bg-[#e3b23c] rounded" style={{ width: `${(data.ordersByWeekday[d].orders / maxWeekday) * 100}%` }} />
                </div>
                <span className="w-24 text-right text-black/60">
                  {data.ordersByWeekday[d].orders} · {money(data.ordersByWeekday[d].revenue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
        <div className="bg-white rounded-xl border border-black/5 p-5">
          <h2 className="font-semibold mb-4">{t("Top-Produkte", "Top products")}</h2>
          {data.topProducts.length === 0 && <p className="text-black/50 text-sm">{t("Noch keine Verkäufe in diesem Zeitraum.", "No sales in this period yet.")}</p>}
          <div className="overflow-x-auto">
            <table className="admin-table min-w-[360px]">
              <thead>
                <tr>
                  <th>{t("Produkt", "Product")}</th>
                  <th className="text-right">{t("Einheiten", "Units")}</th>
                  <th className="text-right">{t("Umsatz", "Revenue")}</th>
                </tr>
              </thead>
              <tbody>
                {data.topProducts.map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td className="text-right">{p.qty}</td>
                    <td className="text-right">{money(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-black/5 p-5">
          <h2 className="font-semibold mb-4">{t("Gutscheine", "Coupons")}</h2>
          {data.coupons.length === 0 ? (
            <p className="text-black/50 text-sm">{t("Keine Gutscheine eingelöst.", "No coupons redeemed.")}</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th className="text-right">{t("Einlösungen", "Uses")}</th>
                  <th className="text-right">{t("Rabatt", "Discount")}</th>
                </tr>
              </thead>
              <tbody>
                {data.coupons.map((c) => (
                  <tr key={c.code}>
                    <td className="font-mono">{c.code}</td>
                    <td className="text-right">{c.uses}</td>
                    <td className="text-right">{money(c.discount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <h2 className="font-semibold mt-6 mb-3">{t("Status (gesamt)", "Status (all time)")}</h2>
          <div className="grid gap-1 text-sm">
            {data.ordersByStatus.map((s) => (
              <div key={s.status} className="flex justify-between">
                <span className="text-black/60">{s.status}</span>
                <span className="font-semibold">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  delta,
  t,
}: {
  icon: typeof Receipt;
  label: string;
  value: string;
  delta?: number;
  t: (de: string, en: string) => string;
}) {
  return (
    <div className="bg-white rounded-xl border border-black/5 p-5">
      <div className="flex items-center gap-2 text-black/50 text-xs uppercase tracking-wide mb-2">
        <Icon size={14} /> {label}
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      {delta !== undefined && (
        <div className={`text-xs mt-1 flex items-center gap-1 ${delta >= 0 ? "text-green-700" : "text-red-700"}`}>
          {/* Wrapped in spans so browser translation can't break React's icon swap (see AdminShell). */}
          <span className="flex shrink-0">{delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}</span>
          <span>
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(0)}% {t("ggü. Vorperiode", "vs. previous period")}
          </span>
        </div>
      )}
    </div>
  );
}
