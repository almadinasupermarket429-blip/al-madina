"use client";

import { useEffect, useState } from "react";
import AdminShell from "../components/AdminShell";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

type Category = { id: string; name: string; slug: string; imageUrl: string | null; sortOrder: number; isActive: boolean; productCount: number };

export default function CategoriesPage() {
  const { t } = useLanguage();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/categories")
      .then((res) => res.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []));
  }, []);

  async function patch(id: string, body: Record<string, unknown>) {
    setError("");
    const res = await fetch(`/api/admin/categories/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else setCategories(data);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const res = await fetch("/api/admin/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName }) });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else {
      setCategories(data);
      setNewName("");
    }
  }

  async function remove(c: Category) {
    const msg =
      c.productCount > 0
        ? t(`„${c.name}“ löschen? ${c.productCount} Produkte werden danach ohne Kategorie angezeigt.`, `Delete “${c.name}”? ${c.productCount} products will become uncategorised.`)
        : t(`„${c.name}“ löschen?`, `Delete “${c.name}”?`);
    if (!confirm(msg)) return;
    const res = await fetch(`/api/admin/categories/${c.id}`, { method: "DELETE" });
    if (res.ok) setCategories(await res.json());
  }

  // Swap sort positions with the neighbour; renumbers everything 0..n so gaps/ties never confuse ordering.
  async function move(index: number, dir: -1 | 1) {
    if (!categories) return;
    const target = index + dir;
    if (target < 0 || target >= categories.length) return;
    const reordered = [...categories];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setCategories(reordered);
    await Promise.all(
      reordered.map((c, i) =>
        c.sortOrder === i
          ? null
          : fetch(`/api/admin/categories/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: i }) })
      )
    );
    const res = await fetch("/api/admin/categories");
    if (res.ok) setCategories(await res.json());
  }

  return (
    <AdminShell>
      <h1 className="font-serif text-3xl mb-1">{t("Kategorien", "Categories")}</h1>
      <p className="text-black/50 text-sm mb-6">
        {t("Reihenfolge bestimmt die Sortierung im Shop. Ausgeblendete Kategorien verstecken ihre Produkte.", "Order controls how the shop is sorted. Hidden categories hide their products.")}
      </p>

      <form onSubmit={add} className="flex gap-2 mb-5 max-w-md">
        <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("Neue Kategorie, z. B. Fleisch & Geflügel", "New category, e.g. Meat & poultry")} />
        <button className="btn-primary shrink-0">
          <Plus size={14} /> {t("Hinzufügen", "Add")}
        </button>
      </form>
      {error && <div className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3 mb-4">{error}</div>}

      {categories === null && <p className="text-black/40 text-sm">{t("Lädt…", "Loading…")}</p>}
      <div className="grid gap-2">
        {categories?.map((c, i) => (
          <div key={c.id} className={`admin-card !p-3 flex flex-wrap items-center gap-3 ${c.isActive ? "" : "opacity-60"}`}>
            <div className="flex flex-col">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="text-black/40 disabled:opacity-20" aria-label={t("Nach oben", "Move up")}>
                <ArrowUp size={14} />
              </button>
              <button onClick={() => move(i, 1)} disabled={i === categories.length - 1} className="text-black/40 disabled:opacity-20" aria-label={t("Nach unten", "Move down")}>
                <ArrowDown size={14} />
              </button>
            </div>
            {c.imageUrl ? <img src={c.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-black/5" />}
            <input
              className="input !w-auto flex-1 min-w-[160px] font-medium"
              defaultValue={c.name}
              onBlur={(e) => e.target.value.trim() !== c.name && patch(c.id, { name: e.target.value })}
              aria-label={t("Name", "Name")}
            />
            <input
              className="input !w-auto flex-1 min-w-[180px] text-xs"
              defaultValue={c.imageUrl ?? ""}
              placeholder={t("Bild-URL (optional)", "Image URL (optional)")}
              onBlur={(e) => e.target.value.trim() !== (c.imageUrl ?? "") && patch(c.id, { imageUrl: e.target.value })}
              aria-label={t("Bild-URL", "Image URL")}
            />
            <span className="text-xs text-black/50 w-20">
              {c.productCount} {t("Produkte", "products")}
            </span>
            <button role="switch" aria-checked={c.isActive} aria-label={t("Im Shop sichtbar", "Visible in shop")} className="admin-switch" onClick={() => patch(c.id, { isActive: !c.isActive })} />
            <button className="btn-danger !px-2.5" onClick={() => remove(c)} aria-label={t(`${c.name} löschen`, `Delete ${c.name}`)}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
