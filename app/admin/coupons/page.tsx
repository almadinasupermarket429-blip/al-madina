"use client";

import { useEffect, useState } from "react";
import AdminShell from "../components/AdminShell";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

type Coupon = {
  id: string;
  code: string;
  description: string | null;
  discountType: "PERCENT" | "FIXED" | "FREE_DELIVERY";
  discountValue: number;
  minSubtotal: number;
  maxUses: number | null;
  oncePerCustomer: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  uses: number;
};

type Form = {
  id?: string;
  code: string;
  description: string;
  discountType: Coupon["discountType"];
  discountValue: string;
  minSubtotal: string;
  maxUses: string;
  oncePerCustomer: boolean;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
};

const EMPTY: Form = {
  code: "",
  description: "",
  discountType: "PERCENT",
  discountValue: "10",
  minSubtotal: "0",
  maxUses: "",
  oncePerCustomer: true,
  startsAt: "",
  expiresAt: "",
  isActive: true,
};

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function CouponsPage() {
  const { t } = useLanguage();
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [editing, setEditing] = useState<Form | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/coupons")
      .then((res) => res.json())
      .then((data) => setCoupons(Array.isArray(data) ? data : []));
  }, []);

  function describe(c: Coupon) {
    if (c.discountType === "PERCENT") return `−${c.discountValue}%`;
    if (c.discountType === "FIXED") return `−€${c.discountValue.toFixed(2)}`;
    return t("Gratis Lieferung", "Free delivery");
  }

  function status(c: Coupon): [string, string] {
    const now = Date.now();
    if (!c.isActive) return [t("Inaktiv", "Inactive"), "bg-black/5 text-black/50"];
    if (c.expiresAt && new Date(c.expiresAt).getTime() < now) return [t("Abgelaufen", "Expired"), "bg-black/5 text-black/50"];
    if (c.startsAt && new Date(c.startsAt).getTime() > now) return [t("Geplant", "Scheduled"), "bg-blue-100 text-blue-800"];
    if (c.maxUses != null && c.uses >= c.maxUses) return [t("Aufgebraucht", "Used up"), "bg-amber-100 text-amber-800"];
    return [t("Aktiv", "Active"), "bg-green-100 text-green-800"];
  }

  async function save() {
    if (!editing) return;
    setError("");
    const payload = {
      ...editing,
      maxUses: editing.maxUses === "" ? null : Number(editing.maxUses),
      startsAt: editing.startsAt ? new Date(editing.startsAt).toISOString() : null,
      expiresAt: editing.expiresAt ? new Date(editing.expiresAt).toISOString() : null,
    };
    const res = await fetch(editing.id ? `/api/admin/coupons/${editing.id}` : "/api/admin/coupons", {
      method: editing.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || t("Speichern fehlgeschlagen.", "Couldn't save."));
      return;
    }
    setCoupons(data);
    setEditing(null);
  }

  async function remove(c: Coupon) {
    if (!confirm(t(`Gutschein ${c.code} löschen?`, `Delete coupon ${c.code}?`))) return;
    const res = await fetch(`/api/admin/coupons/${c.id}`, { method: "DELETE" });
    if (res.ok) setCoupons(await res.json());
  }

  async function toggle(c: Coupon) {
    const res = await fetch(`/api/admin/coupons/${c.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...c, isActive: !c.isActive }),
    });
    if (res.ok) setCoupons(await res.json());
  }

  return (
    <AdminShell>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-serif text-3xl">{t("Gutscheine", "Coupons")}</h1>
          <p className="text-black/50 text-sm mt-1">
            {t("Rabattcodes für Aktionen — Kunden geben sie an der Kasse ein.", "Discount codes for promotions — customers enter them at checkout.")}
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setError("");
            setEditing({ ...EMPTY });
          }}
        >
          <Plus size={15} /> {t("Gutschein erstellen", "New coupon")}
        </button>
      </div>

      {coupons === null && <p className="text-black/40 text-sm">{t("Lädt…", "Loading…")}</p>}
      {coupons?.length === 0 && (
        <div className="admin-card text-center text-black/40 py-12">
          {t("Noch keine Gutscheine. Wie wäre es mit WILLKOMMEN10 für Neukunden?", "No coupons yet. How about WELCOME10 for new customers?")}
        </div>
      )}

      <div className="grid gap-3">
        {coupons?.map((c) => {
          const [label, style] = status(c);
          return (
            <div key={c.id} className="admin-card flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-base">{c.code}</span>
                  <span className="text-sm font-semibold text-[#a12e3d]">{describe(c)}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style}`}>{label}</span>
                </div>
                {c.description && <div className="text-sm text-black/60 mt-0.5">{c.description}</div>}
                <div className="text-xs text-black/40 mt-1 flex flex-wrap gap-x-3">
                  <span>
                    {t("Eingelöst", "Used")}: {c.uses}
                    {c.maxUses != null ? ` / ${c.maxUses}` : ""}
                  </span>
                  {c.minSubtotal > 0 && <span>{t("ab", "min.")} €{c.minSubtotal.toFixed(2)}</span>}
                  {c.oncePerCustomer && <span>{t("1× pro Kunde", "once per customer")}</span>}
                  {c.expiresAt && (
                    <span>
                      {t("bis", "until")} {new Date(c.expiresAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <button role="switch" aria-checked={c.isActive} aria-label={t("Aktiv", "Active")} className="admin-switch" onClick={() => toggle(c)} />
              <button
                className="btn-outline"
                onClick={() => {
                  setError("");
                  setEditing({
                    id: c.id,
                    code: c.code,
                    description: c.description ?? "",
                    discountType: c.discountType,
                    discountValue: String(c.discountValue),
                    minSubtotal: String(c.minSubtotal),
                    maxUses: c.maxUses == null ? "" : String(c.maxUses),
                    oncePerCustomer: c.oncePerCustomer,
                    startsAt: toLocalInput(c.startsAt),
                    expiresAt: toLocalInput(c.expiresAt),
                    isActive: c.isActive,
                  });
                }}
              >
                <Pencil size={13} /> {t("Bearbeiten", "Edit")}
              </button>
              <button className="btn-danger" onClick={() => remove(c)} aria-label={t(`${c.code} löschen`, `Delete ${c.code}`)}>
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 my-8 relative">
            <button onClick={() => setEditing(null)} aria-label={t("Schließen", "Close")} className="absolute right-4 top-4 w-8 h-8 rounded-full bg-black/5 flex items-center justify-center">
              <X size={16} />
            </button>
            <h2 className="font-serif text-2xl mb-5">{editing.id ? t("Gutschein bearbeiten", "Edit coupon") : t("Neuer Gutschein", "New coupon")}</h2>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="admin-label">Code</label>
                  <input
                    className="input font-mono uppercase"
                    value={editing.code}
                    onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                    placeholder="RAMADAN10"
                  />
                </div>
                <div>
                  <label className="admin-label">{t("Art", "Type")}</label>
                  <select
                    className="input"
                    value={editing.discountType}
                    onChange={(e) => setEditing({ ...editing, discountType: e.target.value as Form["discountType"] })}
                  >
                    <option value="PERCENT">{t("Prozent", "Percent")}</option>
                    <option value="FIXED">{t("Fester Betrag (€)", "Fixed amount (€)")}</option>
                    <option value="FREE_DELIVERY">{t("Gratis Lieferung", "Free delivery")}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="admin-label">{t("Beschreibung (optional, für Kunden sichtbar)", "Description (optional, shown to customers)")}</label>
                <input className="input" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {editing.discountType !== "FREE_DELIVERY" && (
                  <div>
                    <label className="admin-label">{editing.discountType === "PERCENT" ? t("Rabatt %", "Discount %") : t("Rabatt €", "Discount €")}</label>
                    <input type="number" step="0.01" min="0" className="input" value={editing.discountValue} onChange={(e) => setEditing({ ...editing, discountValue: e.target.value })} />
                  </div>
                )}
                <div>
                  <label className="admin-label">{t("Mindestwert €", "Min. order €")}</label>
                  <input type="number" step="0.01" min="0" className="input" value={editing.minSubtotal} onChange={(e) => setEditing({ ...editing, minSubtotal: e.target.value })} />
                </div>
                <div>
                  <label className="admin-label">{t("Max. Einlösungen", "Max. uses")}</label>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={editing.maxUses}
                    placeholder="∞"
                    onChange={(e) => setEditing({ ...editing, maxUses: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="admin-label">{t("Gültig ab (optional)", "Valid from (optional)")}</label>
                  <input type="datetime-local" className="input" value={editing.startsAt} onChange={(e) => setEditing({ ...editing, startsAt: e.target.value })} />
                </div>
                <div>
                  <label className="admin-label">{t("Gültig bis (optional)", "Valid until (optional)")}</label>
                  <input type="datetime-local" className="input" value={editing.expiresAt} onChange={(e) => setEditing({ ...editing, expiresAt: e.target.value })} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.oncePerCustomer} onChange={(e) => setEditing({ ...editing, oncePerCustomer: e.target.checked })} />
                {t("Nur einmal pro Kunde", "Once per customer")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.isActive} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} />
                {t("Aktiv", "Active")}
              </label>
              {error && <div className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setEditing(null)} className="btn-outline flex-1 justify-center">
                {t("Abbrechen", "Cancel")}
              </button>
              <button onClick={save} className="btn-primary flex-1 justify-center">
                {t("Speichern", "Save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
