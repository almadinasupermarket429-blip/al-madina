"use client";

import { useEffect, useState } from "react";
import AdminShell from "../components/AdminShell";
import { MailCheck, MailWarning, Search } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  emailVerified: boolean;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  addressCount: number;
};

export default function CustomersPage() {
  const { t, language } = useLanguage();
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      fetch(`/api/admin/customers?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .then((data) => setCustomers(Array.isArray(data) ? data : []));
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const locale = language === "de" ? "de-DE" : "en-GB";
  const total = customers?.reduce((s, c) => s + c.totalSpent, 0) ?? 0;
  const repeat = customers?.filter((c) => c.orderCount >= 2).length ?? 0;

  return (
    <AdminShell>
      <h1 className="font-serif text-3xl mb-1">{t("Kunden", "Customers")}</h1>
      <p className="text-black/50 text-sm mb-6">{t("Alle Kundenkonten mit Bestellstatistik.", "All customer accounts with order stats.")}</p>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="admin-card !p-4">
          <div className="text-[11px] uppercase text-black/50">{t("Kunden", "Customers")}</div>
          <div className="text-xl font-semibold">{customers?.length ?? "–"}</div>
        </div>
        <div className="admin-card !p-4">
          <div className="text-[11px] uppercase text-black/50">{t("Stammkunden (2+)", "Repeat (2+)")}</div>
          <div className="text-xl font-semibold">{repeat}</div>
        </div>
        <div className="admin-card !p-4">
          <div className="text-[11px] uppercase text-black/50">{t("Gesamtumsatz", "Lifetime revenue")}</div>
          <div className="text-xl font-semibold">€{total.toFixed(2)}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-white border border-black/10 rounded-full px-3 py-2 mb-4 max-w-md">
        <Search size={15} className="text-black/40" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("Name, E-Mail oder Telefon…", "Name, email or phone…")}
          className="w-full text-sm outline-none bg-transparent"
          aria-label={t("Kunden suchen", "Search customers")}
        />
      </div>

      <div className="admin-card overflow-x-auto !p-2">
        <table className="admin-table min-w-[720px]">
          <thead>
            <tr>
              <th>{t("Kunde", "Customer")}</th>
              <th>{t("Telefon", "Phone")}</th>
              <th className="text-right">{t("Bestellungen", "Orders")}</th>
              <th className="text-right">{t("Umsatz", "Spent")}</th>
              <th>{t("Letzte Bestellung", "Last order")}</th>
              <th>{t("Kunde seit", "Joined")}</th>
            </tr>
          </thead>
          <tbody>
            {customers?.map((c) => (
              <tr key={c.id}>
                <td>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-black/50 flex items-center gap-1">
                    {c.emailVerified ? <MailCheck size={12} className="text-green-700" /> : <MailWarning size={12} className="text-amber-600" />}
                    <a href={`mailto:${c.email}`} className="hover:underline break-all">
                      {c.email}
                    </a>
                  </div>
                </td>
                <td>{c.phone ? <a href={`tel:${c.phone.replace(/\s/g, "")}`}>{c.phone}</a> : <span className="text-black/30">–</span>}</td>
                <td className="text-right">
                  {c.orderCount}
                  {c.orderCount >= 5 && <span className="ml-1 text-[10px] font-bold bg-[#e3b23c]/30 text-[#7a5a10] px-1.5 py-0.5 rounded-full">VIP</span>}
                </td>
                <td className="text-right">€{c.totalSpent.toFixed(2)}</td>
                <td>{c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString(locale) : <span className="text-black/30">–</span>}</td>
                <td>{new Date(c.createdAt).toLocaleDateString(locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers?.length === 0 && <p className="text-center text-black/40 text-sm py-8">{t("Keine Kunden gefunden.", "No customers found.")}</p>}
      </div>
    </AdminShell>
  );
}
