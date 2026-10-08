"use client";

import { useEffect, useState } from "react";
import AdminShell from "../components/AdminShell";
import { Check, Save } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import type { StoreSettings } from "@/lib/settings-shared";

export default function SettingsPage() {
  const { t } = useLanguage();
  const [form, setForm] = useState<StoreSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then(setForm);
  }, []);

  function set<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setSaved(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || t("Speichern fehlgeschlagen.", "Couldn't save."));
    else {
      setForm(data);
      setSaved(true);
    }
    setSaving(false);
  }

  if (!form) {
    return (
      <AdminShell>
        <p className="text-black/40 text-sm">{t("Lädt…", "Loading…")}</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <h1 className="font-serif text-3xl mb-1">{t("Einstellungen", "Settings")}</h1>
      <p className="text-black/50 text-sm mb-6">
        {t("Gebühren, Mindestbestellwert und Shop-Hinweise — Änderungen gelten sofort.", "Fees, minimum order and shop notices — changes apply immediately.")}
      </p>

      <form onSubmit={save} className="grid gap-5 max-w-2xl">
        <section className="admin-card grid gap-4">
          <h2 className="font-semibold">{t("Bestellannahme", "Taking orders")}</h2>
          <Toggle
            label={t("Online-Bestellungen annehmen", "Accept online orders")}
            hint={t("Aus = Kasse ist gesperrt, der Shop bleibt sichtbar.", "Off = checkout is blocked; the shop stays visible.")}
            checked={form.acceptingOrders}
            onChange={(v) => set("acceptingOrders", v)}
          />
          <div>
            <label className="admin-label">{t("Hinweis, wenn pausiert", "Message when paused")}</label>
            <input className="input" value={form.closedMessage} onChange={(e) => set("closedMessage", e.target.value)} maxLength={500} />
          </div>
          <Toggle label={t("Lieferung anbieten", "Offer delivery")} checked={form.deliveryEnabled} onChange={(v) => set("deliveryEnabled", v)} />
          <Toggle label={t("Abholung anbieten", "Offer pickup")} checked={form.pickupEnabled} onChange={(v) => set("pickupEnabled", v)} />
          <Toggle
            label={t("Zeitfenster verpflichtend", "Require a time slot")}
            hint={t("Nur wirksam, wenn unter „Zeitfenster“ buchbare Slots existieren.", "Only applies while bookable slots exist under “Time slots”.")}
            checked={form.requireSlot}
            onChange={(v) => set("requireSlot", v)}
          />
        </section>

        <section className="admin-card grid gap-4">
          <h2 className="font-semibold">{t("Preise & Lieferung", "Pricing & delivery")}</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <Money label={t("Liefergebühr", "Delivery fee")} value={form.deliveryFee} onChange={(v) => set("deliveryFee", v)} />
            <Money
              label={t("Kostenlos ab", "Free delivery from")}
              hint={t("0 = nie kostenlos", "0 = never free")}
              value={form.freeDeliveryThreshold}
              onChange={(v) => set("freeDeliveryThreshold", v)}
            />
            <Money
              label={t("Mindestbestellwert", "Minimum order")}
              hint={t("0 = kein Minimum", "0 = no minimum")}
              value={form.minimumOrder}
              onChange={(v) => set("minimumOrder", v)}
            />
          </div>
          <div>
            <label className="admin-label">{t("Liefergebiet (Hinweis an der Kasse)", "Delivery area (shown at checkout)")}</label>
            <input className="input" value={form.deliveryArea} onChange={(e) => set("deliveryArea", e.target.value)} maxLength={200} />
          </div>
        </section>

        <section className="admin-card grid gap-3">
          <h2 className="font-semibold">{t("Shop-Banner", "Shop banner")}</h2>
          <p className="text-xs text-black/50">
            {t(
              "Erscheint ganz oben im Shop, z. B. „Frisches Lammfleisch eingetroffen!“ oder „Am Feiertag geschlossen“. Leer = Standardbanner.",
              "Shown at the very top of the shop, e.g. “Fresh lamb just arrived!” or “Closed on the holiday”. Empty = default banner."
            )}
          </p>
          <input className="input" value={form.announcement} onChange={(e) => set("announcement", e.target.value)} maxLength={200} />
        </section>

        {error && <div className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={saving}>
            <Save size={14} /> {saving ? t("Speichert…", "Saving…") : t("Speichern", "Save")}
          </button>
          {saved && (
            <span className="text-sm text-green-700 flex items-center gap-1">
              <Check size={14} /> {t("Gespeichert", "Saved")}
            </span>
          )}
        </div>
      </form>
    </AdminShell>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-black/50">{hint}</div>}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} className="admin-switch" onClick={() => onChange(!checked)} />
    </div>
  );
}

function Money({ label, hint, value, onChange }: { label: string; hint?: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="admin-label">{label}</label>
      <div className="flex items-center gap-1">
        <span className="text-black/40 text-sm">€</span>
        <input type="number" step="0.01" min="0" className="input" value={value} onChange={(e) => onChange(Number(e.target.value))} />
      </div>
      {hint && <div className="text-[11px] text-black/40 mt-1">{hint}</div>}
    </div>
  );
}
