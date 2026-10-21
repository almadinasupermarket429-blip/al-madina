"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye, EyeOff, FileUp, FolderInput, Minus, Pencil, Percent, Plus, Search, Trash2, X } from "lucide-react";
import AdminShell from "../components/AdminShell";
import { useLanguage } from "@/lib/i18n";
import { sizedImage } from "@/lib/images";
import { LOW_STOCK_THRESHOLD } from "@/lib/order-utils";
import { ImportDialog } from "./ImportDialog";
import { ProductEditor } from "./ProductEditor";
import { EMPTY_PRODUCT, type AdminProduct, type EditableProduct } from "./types";

type Filter = "all" | "low" | "out" | "hidden" | "sale";
type Notice = { ok: boolean; text: string } | null;

export default function AdminProductsPage() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditableProduct | null>(null);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState<Notice>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/products");
    if (res.ok) setProducts(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(), [products]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (category && p.category !== category) return false;
      if (q && !`${p.name} ${p.nameEn ?? ""} ${p.brand ?? ""} ${p.category} ${(p.tags ?? []).join(" ")}`.toLowerCase().includes(q)) return false;
      const stocks = p.sizes.map((s) => Number(s.stock ?? 0));
      if (filter === "low") return stocks.some((n) => n <= LOW_STOCK_THRESHOLD);
      if (filter === "out") return stocks.some((n) => n === 0);
      if (filter === "hidden") return !p.active;
      if (filter === "sale") return p.sizes.some((s) => s.oldPrice);
      return true;
    });
  }, [products, search, filter, category]);

  const counts = useMemo(
    () => ({
      low: products.filter((p) => p.sizes.some((s) => Number(s.stock ?? 0) <= LOW_STOCK_THRESHOLD)).length,
      out: products.filter((p) => p.sizes.some((s) => Number(s.stock ?? 0) === 0)).length,
      hidden: products.filter((p) => !p.active).length,
    }),
    [products]
  );

  const allShownSelected = shown.length > 0 && shown.every((p) => selected.has(p.id));
  const toggleAll = () => setSelected(allShownSelected ? new Set() : new Set(shown.map((p) => p.id)));
  const toggleOne = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Inline edit of one size (stock +/- or a new price), straight from the list.
  async function patchVariant(productId: string, sizeId: string, body: { adjust?: number; stock?: number; price?: number }) {
    const res = await fetch(`/api/admin/variants/${sizeId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setNotice({ ok: false, text: err.error || t("Änderung fehlgeschlagen.", "Change failed.") });
      return;
    }
    const { stock, price } = await res.json();
    setProducts((cur) => cur.map((p) => (p.id === productId ? { ...p, sizes: p.sizes.map((s) => (s.id === sizeId ? { ...s, stock, price } : s)) } : p)));
  }

  async function bulk(action: "show" | "hide" | "delete" | "category" | "price_percent") {
    const ids = [...selected];
    if (ids.length === 0) return;
    let value: string | number | undefined;
    if (action === "category") {
      const v = prompt(t(`Neue Kategorie für ${ids.length} Produkte:`, `New category for ${ids.length} products:`), categories[0] ?? "");
      if (!v?.trim()) return;
      value = v.trim();
    }
    if (action === "price_percent") {
      const v = prompt(t("Preise ändern um wie viel Prozent? (z. B. 10 oder -5)", "Change prices by what percent? (e.g. 10 or -5)"), "10");
      if (v == null || v.trim() === "") return;
      value = Number(v.replace(",", "."));
    }
    if (action === "delete" && !confirm(t(`${ids.length} Produkte endgültig löschen?`, `Permanently delete ${ids.length} products?`))) return;
    const res = await fetch("/api/admin/products/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, action, value }) });
    const data = await res.json().catch(() => ({}));
    setNotice(res.ok ? { ok: true, text: data.summary } : { ok: false, text: data.error || t("Aktion fehlgeschlagen.", "Action failed.") });
    if (res.ok) {
      setSelected(new Set());
      load();
    }
  }

  async function handleDelete(p: AdminProduct) {
    if (!confirm(t(`„${p.name}“ löschen? Dies kann nicht rückgängig gemacht werden.`, `Delete “${p.name}”? This cannot be undone.`))) return;
    setProducts((cur) => cur.filter((x) => x.id !== p.id));
    const res = await fetch(`/api/products/${p.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setNotice(
      !res.ok
        ? { ok: false, text: t("Löschen fehlgeschlagen.", "Couldn't delete.") }
        : data.hidden
          ? { ok: true, text: t("Produkt ist in Bestellungen enthalten und wurde daher ausgeblendet statt gelöscht.", "Product appears in orders, so it was hidden instead of deleted.") }
          : { ok: true, text: t("Produkt gelöscht.", "Product deleted.") }
    );
    load();
  }

  async function handleSave(data: EditableProduct) {
    const payload = {
      ...data,
      sizes: data.sizes
        .filter((s) => s.label && s.price !== "")
        .map((s) => ({
          id: s.id,
          label: s.label,
          price: Number(s.price),
          oldPrice: s.oldPrice ? Number(s.oldPrice) : undefined,
          // "" (never touched) falls back to the server default; an explicit 0 must stay 0 ("out of stock").
          stock: s.stock === "" || s.stock == null ? undefined : Number(s.stock),
        })),
    };
    setSaveError("");
    const res = await fetch(data.id ? `/api/products/${data.id}` : `/api/products`, {
      method: data.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setSaveError(err.error || t("Speichern fehlgeschlagen.", "Couldn't save."));
      return;
    }
    const saved: AdminProduct = await res.json();
    setProducts((cur) => (data.id ? cur.map((p) => (p.id === saved.id ? { ...p, ...saved } : p)) : [saved, ...cur]));
    setEditing(null);
    setNotice({ ok: true, text: t(`„${saved.name}“ gespeichert.`, `“${saved.name}” saved.`) });
    load();
  }

  const filterChip = (key: Filter, label: string, count?: number) => (
    <button
      key={key}
      onClick={() => setFilter(key)}
      className={`px-3 py-1.5 rounded-full text-sm border ${filter === key ? "bg-[#a12e3d] text-white border-[#a12e3d]" : "bg-white border-black/10 text-black/60"}`}
    >
      {label}
      {count ? <span className="ml-1 opacity-70">({count})</span> : null}
    </button>
  );

  return (
    <AdminShell>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-serif text-3xl">{t("Produkte", "Products")}</h1>
          <p className="text-black/50 text-sm mt-1">
            {t(`${products.length} Produkte · Preise, Bestand und Texte verwalten.`, `${products.length} products · manage prices, stock and texts.`)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/admin/products/export" className="btn-outline" download>
            <Download size={14} /> {t("Exportieren (Excel/CSV)", "Export (Excel/CSV)")}
          </a>
          <button onClick={() => setImporting(true)} className="btn-outline">
            <FileUp size={14} /> {t("Importieren", "Import")}
          </button>
          <button onClick={() => setEditing({ ...EMPTY_PRODUCT })} className="btn-primary">
            <Plus size={15} /> {t("Produkt hinzufügen", "Add product")}
          </button>
        </div>
      </div>

      {notice && (
        <div className={`rounded-xl text-sm px-4 py-3 mb-4 flex justify-between gap-2 ${notice.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`} role="status">
          {notice.text}
          <button onClick={() => setNotice(null)} aria-label={t("Schließen", "Close")}>
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <div className="flex items-center gap-2 bg-white border border-black/10 rounded-full px-3 py-2 flex-1 min-w-[200px] max-w-md">
          <Search size={15} className="text-black/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Produkt, Marke, Kategorie oder Tag…", "Product, brand, category or tag…")}
            className="w-full text-sm outline-none bg-transparent"
            aria-label={t("Produkte suchen", "Search products")}
          />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input !w-auto !rounded-full !py-2" aria-label={t("Kategorie", "Category")}>
          <option value="">{t("Alle Kategorien", "All categories")}</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {filterChip("all", t("Alle", "All"))}
        {filterChip("low", t("Wenig Bestand", "Low stock"), counts.low)}
        {filterChip("out", t("Ausverkauft", "Out of stock"), counts.out)}
        {filterChip("sale", t("Im Angebot", "On sale"))}
        {filterChip("hidden", t("Versteckt", "Hidden"), counts.hidden)}
      </div>

      {selected.size > 0 && (
        <div className="sticky top-2 z-30 bg-[#18201b] text-white rounded-2xl px-4 py-3 mb-4 flex flex-wrap items-center gap-2 shadow-lg" role="toolbar" aria-label={t("Mehrfachaktionen", "Bulk actions")}>
          <b className="mr-2">{t(`${selected.size} ausgewählt`, `${selected.size} selected`)}</b>
          <button className="btn-outline !py-1.5" onClick={() => bulk("show")}>
            <Eye size={13} /> {t("Einblenden", "Show")}
          </button>
          <button className="btn-outline !py-1.5" onClick={() => bulk("hide")}>
            <EyeOff size={13} /> {t("Ausblenden", "Hide")}
          </button>
          <button className="btn-outline !py-1.5" onClick={() => bulk("category")}>
            <FolderInput size={13} /> {t("Kategorie ändern", "Change category")}
          </button>
          <button className="btn-outline !py-1.5" onClick={() => bulk("price_percent")}>
            <Percent size={13} /> {t("Preise ± %", "Prices ± %")}
          </button>
          <button className="btn-danger !py-1.5" onClick={() => bulk("delete")}>
            <Trash2 size={13} /> {t("Löschen", "Delete")}
          </button>
          <button className="ml-auto text-white/70 text-sm underline" onClick={() => setSelected(new Set())}>
            {t("Auswahl aufheben", "Clear selection")}
          </button>
        </div>
      )}

      {loading && <div className="text-black/40 text-sm">{t("Produkte werden geladen…", "Loading products…")}</div>}

      {!loading && shown.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-black/60 mb-2 ml-1">
          <input type="checkbox" checked={allShownSelected} onChange={toggleAll} />
          {t(`Alle ${shown.length} angezeigten auswählen`, `Select all ${shown.length} shown`)}
        </label>
      )}

      <div className="grid gap-2">
        {shown.map((p) => (
          <div key={p.id} className={`bg-white rounded-2xl border p-3 flex items-center gap-3 ${selected.has(p.id) ? "border-[#a12e3d]" : "border-black/5"}`}>
            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} aria-label={t(`${p.name} auswählen`, `Select ${p.name}`)} />
            <img src={sizedImage(p.image, 160)} alt="" className="w-14 h-14 rounded-xl object-contain bg-white shrink-0" loading="lazy" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{p.name}</span>
                {!p.active && <span className="text-[10px] font-bold bg-black/10 text-black/50 px-2 py-0.5 rounded-full">{t("VERSTECKT", "HIDDEN")}</span>}
                {p.badge && <span className="text-[10px] font-bold bg-[#e3b23c]/30 text-[#7a5a10] px-2 py-0.5 rounded-full">{p.badge}</span>}
                {!p.nameEn && <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{t("EN fehlt", "EN missing")}</span>}
              </div>
              <div className="text-xs text-black/40 mt-0.5">
                {p.category}
                {p.brand ? ` · ${p.brand}` : ""}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {p.sizes.map((s, i) => {
                  const stock = s.stock != null ? Number(s.stock) : null;
                  const low = stock != null && stock <= LOW_STOCK_THRESHOLD;
                  return (
                    <span
                      key={s.id ?? i}
                      className={`text-[11px] rounded-full pl-2 pr-1 py-0.5 inline-flex items-center gap-1 ${low ? (stock === 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800") : "bg-black/5"}`}
                    >
                      {s.label} ·{" "}
                      {s.id ? (
                        <button
                          className="font-semibold underline decoration-dotted"
                          title={t("Preis ändern", "Change price")}
                          onClick={() => {
                            const v = prompt(t(`Neuer Preis für ${p.name} (${s.label}) in €:`, `New price for ${p.name} (${s.label}) in €:`), Number(s.price).toFixed(2));
                            const n = v == null ? NaN : Number(v.replace(",", "."));
                            if (Number.isFinite(n) && n >= 0) patchVariant(p.id, s.id!, { price: n });
                          }}
                        >
                          €{Number(s.price).toFixed(2)}
                        </button>
                      ) : (
                        `€${Number(s.price).toFixed(2)}`
                      )}
                      {stock != null && ` · ${stock === 0 ? t("ausverkauft", "out of stock") : t(`${stock} auf Lager`, `${stock} in stock`)}`}
                      {s.id && (
                        <>
                          <button
                            onClick={() => patchVariant(p.id, s.id!, { adjust: -1 })}
                            className="w-5 h-5 rounded-full bg-white/80 inline-flex items-center justify-center"
                            aria-label={t(`${p.name} ${s.label}: Bestand −1`, `${p.name} ${s.label}: stock −1`)}
                          >
                            <Minus size={10} />
                          </button>
                          <button
                            onClick={() => patchVariant(p.id, s.id!, { adjust: 1 })}
                            className="w-5 h-5 rounded-full bg-white/80 inline-flex items-center justify-center"
                            aria-label={t(`${p.name} ${s.label}: Bestand +1`, `${p.name} ${s.label}: stock +1`)}
                          >
                            <Plus size={10} />
                          </button>
                          <button
                            onClick={() => {
                              const v = prompt(t(`Neuer Bestand für ${p.name} (${s.label}):`, `New stock for ${p.name} (${s.label}):`), String(stock ?? 0));
                              if (v !== null && v.trim() !== "" && Number(v) >= 0) patchVariant(p.id, s.id!, { stock: Number(v) });
                            }}
                            className="px-1.5 h-5 rounded-full bg-white/80 text-[10px] font-semibold"
                          >
                            {t("setzen", "set")}
                          </button>
                        </>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
            <button onClick={() => setEditing(p)} className="btn-outline">
              <Pencil size={13} /> <span className="hidden sm:inline">{t("Bearbeiten", "Edit")}</span>
            </button>
            <button onClick={() => handleDelete(p)} className="btn-danger" aria-label={t(`${p.name} löschen`, `Delete ${p.name}`)}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {!loading && products.length > 0 && shown.length === 0 && (
          <div className="bg-white rounded-2xl border border-black/5 p-8 text-center text-black/40">{t("Keine Treffer.", "No matches.")}</div>
        )}
        {!loading && products.length === 0 && (
          <div className="bg-white rounded-2xl border border-black/5 p-12 text-center text-black/40">
            {t("Noch keine Produkte — klicken Sie auf „Produkt hinzufügen“.", "No products yet — click “Add product”.")}
          </div>
        )}
      </div>

      {editing && (
        <ProductEditor
          initial={editing}
          categories={categories}
          error={saveError}
          onClose={() => {
            setEditing(null);
            setSaveError("");
          }}
          onSave={handleSave}
        />
      )}
      {importing && <ImportDialog onClose={() => setImporting(false)} onApplied={load} />}
    </AdminShell>
  );
}
