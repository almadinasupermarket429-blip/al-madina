"use client";

import { useEffect, useMemo, useState } from "react";
import AdminShell from "../components/AdminShell";
import { Minus, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { LOW_STOCK_THRESHOLD } from "@/lib/order-utils";

type Size = { id?: string; label: string; price: number | string; oldPrice?: number | string | null; stock?: number | string };
type Product = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  image: string;
  badge: string | null;
  unitNote: string | null;
  tags: string[];
  active: boolean;
  sizes: Size[];
};

const EMPTY: Omit<Product, "id"> = {
  name: "",
  category: "",
  description: "",
  image: "",
  badge: "",
  unitNote: "",
  tags: [],
  active: true,
  sizes: [{ label: "", price: "" }],
};

export default function AdminProductsPage() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | (Omit<Product, "id"> & { id?: string }) | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out" | "hidden" | "sale">("all");
  const [saveError, setSaveError] = useState("");

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !`${p.name} ${p.category} ${(p.tags ?? []).join(" ")}`.toLowerCase().includes(q)) return false;
      const stocks = p.sizes.map((s) => Number(s.stock ?? 0));
      if (filter === "low") return stocks.some((n) => n <= LOW_STOCK_THRESHOLD);
      if (filter === "out") return stocks.some((n) => n === 0);
      if (filter === "hidden") return !p.active;
      if (filter === "sale") return p.sizes.some((s) => s.oldPrice);
      return true;
    });
  }, [products, search, filter]);

  // Inline stock change for one size — updates the row immediately, no form round trip.
  async function changeStock(productId: string, sizeId: string, body: { adjust?: number; stock?: number }) {
    const res = await fetch(`/api/admin/variants/${sizeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return;
    const { stock } = await res.json();
    setProducts((cur) =>
      cur.map((p) => (p.id === productId ? { ...p, sizes: p.sizes.map((s) => (s.id === sizeId ? { ...s, stock } : s)) } : p))
    );
  }

  // Categories are free-form (typed, then found-or-created server-side) —
  // suggest whatever's actually in use rather than a fixed, possibly stale list.
  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort();

  async function load() {
    setLoading((cur) => cur || products.length === 0);
    const res = await fetch("/api/products");
    if (res.ok) setProducts(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm(t("Dieses Produkt löschen? Dies kann nicht rückgängig gemacht werden.", "Delete this product? This cannot be undone."))) return;
    setProducts((cur) => cur.filter((p) => p.id !== id));
    await fetch(`/api/products/${id}`, { method: "DELETE" });
  }

  async function handleSave(data: typeof EMPTY & { id?: string }) {
    const payload = {
      ...data,
      sizes: data.sizes
        .filter((s) => s.label && s.price !== "")
        .map((s) => ({
          id: s.id,
          label: s.label,
          price: Number(s.price),
          oldPrice: s.oldPrice ? Number(s.oldPrice) : undefined,
          // "" (never touched) falls back to the server default (999) — an
          // explicit 0 must survive as 0 so "out of stock" can be set.
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
    // Show the saved product right away from the response; the reload then catches anything else that changed.
    const saved: Product = await res.json();
    setProducts((cur) => (data.id ? cur.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...cur]));
    setEditing(null);
    load();
  }

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl">{t("Produkte", "Products")}</h1>
          <p className="text-black/50 text-sm mt-1">{t("Verwalten Sie, was im Shop verkauft wird — einschließlich Größenoptionen.", "Manage what's for sale in the Shop tab — including size options.")}</p>
        </div>
        <button onClick={() => setEditing({ ...EMPTY })} className="btn-primary">
          <Plus size={15} /> {t("Produkt hinzufügen", "Add product")}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <div className="flex items-center gap-2 bg-white border border-black/10 rounded-full px-3 py-2 flex-1 min-w-[200px] max-w-md">
          <Search size={15} className="text-black/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Produkt, Kategorie oder Tag…", "Product, category or tag…")}
            className="w-full text-sm outline-none bg-transparent"
            aria-label={t("Produkte suchen", "Search products")}
          />
        </div>
        {(
          [
            ["all", t("Alle", "All")],
            ["low", t("Wenig Bestand", "Low stock")],
            ["out", t("Ausverkauft", "Out of stock")],
            ["sale", t("Im Angebot", "On sale")],
            ["hidden", t("Versteckt", "Hidden")],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-full text-sm border ${filter === key ? "bg-[#a12e3d] text-white border-[#a12e3d]" : "bg-white border-black/10 text-black/60"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <div className="text-black/40 text-sm">{t("Produkte werden geladen…", "Loading products…")}</div>}

      <div className="grid gap-3">
        {shown.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl border border-black/5 p-4 flex items-center gap-4">
            <img src={p.image} alt={p.name} className="w-16 h-16 rounded-xl object-cover bg-black/5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.name}</span>
                {!p.active && <span className="text-[10px] font-bold bg-black/10 text-black/50 px-2 py-0.5 rounded-full">{t("VERSTECKT", "HIDDEN")}</span>}
                {p.badge && <span className="text-[10px] font-bold bg-[#e3b23c]/30 text-[#7a5a10] px-2 py-0.5 rounded-full">{p.badge}</span>}
              </div>
              <div className="text-xs text-black/40 mt-0.5">
                {p.category}
                {p.tags?.length ? ` · ${p.tags.join(", ")}` : ""}
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
                      {s.label} · €{Number(s.price).toFixed(2)}
                      {stock != null && ` · ${stock === 0 ? t("ausverkauft", "out of stock") : t(`${stock} auf Lager`, `${stock} in stock`)}`}
                      {s.id && (
                        <>
                          <button
                            onClick={() => changeStock(p.id, s.id!, { adjust: -1 })}
                            className="w-5 h-5 rounded-full bg-white/80 inline-flex items-center justify-center"
                            aria-label={t(`${p.name} ${s.label}: Bestand −1`, `${p.name} ${s.label}: stock −1`)}
                          >
                            <Minus size={10} />
                          </button>
                          <button
                            onClick={() => changeStock(p.id, s.id!, { adjust: 1 })}
                            className="w-5 h-5 rounded-full bg-white/80 inline-flex items-center justify-center"
                            aria-label={t(`${p.name} ${s.label}: Bestand +1`, `${p.name} ${s.label}: stock +1`)}
                          >
                            <Plus size={10} />
                          </button>
                          <button
                            onClick={() => {
                              const v = prompt(t(`Neuer Bestand für ${p.name} (${s.label}):`, `New stock for ${p.name} (${s.label}):`), String(stock ?? 0));
                              if (v !== null && v.trim() !== "" && Number(v) >= 0) changeStock(p.id, s.id!, { stock: Number(v) });
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
              <Pencil size={13} /> {t("Bearbeiten", "Edit")}
            </button>
            <button onClick={() => handleDelete(p.id)} className="btn-danger" aria-label={t(`${p.name} löschen`, `Delete ${p.name}`)}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {!loading && products.length > 0 && shown.length === 0 && (
          <div className="bg-white rounded-2xl border border-black/5 p-8 text-center text-black/40">{t("Keine Treffer.", "No matches.")}</div>
        )}
        {!loading && products.length === 0 && (
          <div className="bg-white rounded-2xl border border-black/5 p-12 text-center text-black/40">
            {t('Noch keine Produkte — klicken Sie auf „Produkt hinzufügen", um Ihr erstes zu erstellen.', 'No products yet — click "Add product" to create your first one.')}
          </div>
        )}
      </div>

      {editing && (
        <ProductModal
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
    </AdminShell>
  );
}

function ProductModal({
  initial,
  categories,
  error,
  onClose,
  onSave,
}: {
  initial: Omit<Product, "id"> & { id?: string };
  categories: string[];
  error: string;
  onClose: () => void;
  onSave: (data: typeof EMPTY & { id?: string }) => void;
}) {
  const { t } = useLanguage();
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    ...initial,
    tags: initial.tags ?? [],
    sizes: initial.sizes.length ? initial.sizes : [{ label: "", price: "" }],
  }));
  const [tagText, setTagText] = useState((initial.tags ?? []).join(", "));

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setSize(index: number, patch: Partial<Size>) {
    setForm((f) => ({ ...f, sizes: f.sizes.map((s, i) => (i === index ? { ...s, ...patch } : s)) }));
  }

  function addSize() {
    setForm((f) => ({ ...f, sizes: [...f.sizes, { label: "", price: "" }] }));
  }

  function removeSize(index: number) {
    setForm((f) => ({ ...f, sizes: f.sizes.filter((_, i) => i !== index) }));
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 my-8 relative">
        <button onClick={onClose} aria-label={t("Schließen", "Close")} className="absolute right-4 top-4 w-8 h-8 rounded-full bg-black/5 flex items-center justify-center">
          <X size={16} />
        </button>
        <h2 className="font-serif text-2xl mb-5">{form.id ? t("Produkt bearbeiten", "Edit product") : t("Produkt hinzufügen", "Add product")}</h2>

        <div className="grid gap-3">
          <Field label={t("Name", "Name")}>
            <input value={form.name} onChange={(e) => setField("name", e.target.value)} className="input" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Kategorie", "Category")}>
              <input
                value={form.category}
                onChange={(e) => setField("category", e.target.value)}
                placeholder={t("z. B. Bäckerei", "e.g. Bakery")}
                list="category-suggestions"
                className="input"
                required
              />
              <datalist id="category-suggestions">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label={t("Abzeichen (optional)", "Badge (optional)")}>
              <input value={form.badge || ""} onChange={(e) => setField("badge", e.target.value)} placeholder={t("z. B. Heute frisch", "e.g. Heute frisch")} className="input" />
            </Field>
          </div>

          <Field label={t("Bild-URL", "Image URL")}>
            <input value={form.image} onChange={(e) => setField("image", e.target.value)} placeholder="https://…" className="input" />
          </Field>

          <Field label={t("Beschreibung (optional)", "Description (optional)")}>
            <textarea value={form.description || ""} onChange={(e) => setField("description", e.target.value)} className="input" rows={2} />
          </Field>

          <Field label={t("Tags (kommagetrennt, z. B. Halal, Vegan, Bio, Türkei)", "Tags (comma-separated, e.g. Halal, Vegan, Organic, Turkey)")}>
            <input
              value={tagText}
              onChange={(e) => {
                setTagText(e.target.value);
                setField("tags", e.target.value.split(",").map((x) => x.trim()).filter(Boolean));
              }}
              placeholder="Halal, Vegan"
              className="input"
            />
          </Field>

          <Field label={t("Einheit-Hinweis (optional)", "Unit note (optional)")}>
            <input value={form.unitNote || ""} onChange={(e) => setField("unitNote", e.target.value)} placeholder={t("z. B. verkauft pro kg", "e.g. sold per kg")} className="input" />
          </Field>

          <div>
            <label className="text-xs font-semibold text-black/60 mb-1.5 block">{t("Größen, Preise & Bestand", "Sizes, prices & stock")}</label>
            <div className="grid gap-2">
              {form.sizes.map((s, i) => (
                <div key={i} className="border border-black/10 rounded-lg p-2.5 grid gap-2">
                  <div className="flex gap-2 items-center">
                    <input
                      value={s.label}
                      onChange={(e) => setSize(i, { label: e.target.value })}
                      placeholder={t("z. B. 500g / 1kg / Klein", "e.g. 500g / 1kg / Small")}
                      className="input flex-1"
                    />
                    <button onClick={() => removeSize(i)} aria-label={t("Größe entfernen", "Remove size")} className="w-9 h-9 rounded-lg bg-black/5 flex items-center justify-center shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      step="0.01"
                      value={s.price}
                      onChange={(e) => setSize(i, { price: e.target.value })}
                      placeholder={t("Preis €", "Price €")}
                      className="input"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={s.oldPrice ?? ""}
                      onChange={(e) => setSize(i, { oldPrice: e.target.value })}
                      placeholder={t("Vorher €", "Was €")}
                      className="input"
                    />
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={s.stock ?? ""}
                      onChange={(e) => setSize(i, { stock: e.target.value })}
                      placeholder={t("Bestand", "Stock")}
                      className="input"
                    />
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addSize} className="btn-outline mt-2">
              <Plus size={13} /> {t("Weitere Größe hinzufügen", "Add another size")}
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm mt-1">
            <input type="checkbox" checked={form.active} onChange={(e) => setField("active", e.target.checked)} />
            {t("Im Shop sichtbar", "Visible in the shop")}
          </label>
        </div>

        {error && <div className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3 mt-4">{error}</div>}
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="btn-outline flex-1 justify-center">
            {t("Abbrechen", "Cancel")}
          </button>
          <button onClick={() => onSave(form)} className="btn-primary flex-1 justify-center">
            {t("Produkt speichern", "Save product")}
          </button>
        </div>
      </div>

    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-black/60 mb-1 block">{label}</label>
      {children}
    </div>
  );
}
