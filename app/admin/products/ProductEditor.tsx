"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { sizedImage } from "@/lib/images";
import { ALLERGENS, MISSING_LABELS, NUTRIENTS, SIZE_UNITS, formatUnitPrice, missingFoodInfo, parseSizeLabel, type Nutrition } from "@/lib/food-info";
import { EMPTY_PRODUCT, type EditableProduct, type Size, type Spec } from "./types";

type Props = {
  initial: EditableProduct;
  categories: string[];
  error: string;
  onClose: () => void;
  onSave: (data: EditableProduct) => void;
};

const linesToList = (v: string) => v.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

function Field({ label, children, hint, required }: { label: string; children: React.ReactNode; hint?: string; required?: boolean }) {
  return (
    <div>
      <label className="text-xs font-semibold text-black/60 mb-1 block">
        {label}
        {required && <span className="text-red-700"> *</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-black/40 mt-1">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border border-black/10 rounded-xl p-4 grid gap-3">
      <legend className="px-1 text-xs font-bold uppercase tracking-wider text-black/50">{title}</legend>
      {children}
    </fieldset>
  );
}

/** Add/edit form: German + English text, photo upload, bullet points, details table, sizes. */
export function ProductEditor({ initial, categories, error, onClose, onSave }: Props) {
  const { t } = useLanguage();
  const [form, setForm] = useState<EditableProduct>(() => ({
    ...EMPTY_PRODUCT,
    ...initial,
    tags: initial.tags ?? [],
    specs: initial.specs ?? [],
    sizes: initial.sizes.length ? initial.sizes : [{ label: "", price: "" }],
  }));
  const [tagText, setTagText] = useState((initial.tags ?? []).join(", "));
  const [highlightsDe, setHighlightsDe] = useState((initial.highlights ?? []).join("\n"));
  const [highlightsEn, setHighlightsEn] = useState((initial.highlightsEn ?? []).join("\n"));
  const [galleryText, setGalleryText] = useState((initial.gallery ?? []).join("\n"));
  // Nutrition values are typed as text (German decimal comma allowed) and turned into numbers on save.
  const [nutritionText, setNutritionText] = useState<Record<string, string>>(() =>
    Object.fromEntries(NUTRIENTS.map((n) => [n.key, initial.nutrition?.[n.key] != null ? String(initial.nutrition[n.key]).replace(".", ",") : ""]))
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof EditableProduct>(key: K, value: EditableProduct[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setSize = (i: number, patch: Partial<Size>) => setForm((f) => ({ ...f, sizes: f.sizes.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  // Typing "500 g" as the size label fills in the net quantity, unless one is already set.
  const setSizeLabel = (i: number, label: string) => {
    const parsed = parseSizeLabel(label);
    const cur = form.sizes[i];
    const empty = cur.sizeValue === "" || cur.sizeValue == null;
    setSize(i, parsed && empty ? { label, sizeValue: parsed.value, sizeUnit: parsed.unit } : { label });
  };
  const toggleAllergen = (key: string) =>
    setForm((f) => ({ ...f, allergens: f.allergens.includes(key) ? f.allergens.filter((a) => a !== key) : [...f.allergens, key] }));
  const nutritionValues = (): Nutrition | null => {
    const out: Nutrition = {};
    for (const n of NUTRIENTS) {
      const raw = nutritionText[n.key]?.trim().replace(",", ".");
      if (raw) out[n.key] = Number(raw);
    }
    return Object.keys(out).length ? out : null;
  };
  const missing = missingFoodInfo({ ...form, nutrition: nutritionValues() });
  const setSpec = (i: number, patch: Partial<Spec>) => setForm((f) => ({ ...f, specs: (f.specs ?? []).map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  async function upload(file: File) {
    setUploadError("");
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setUploadError(data.error || t("Upload fehlgeschlagen.", "Upload failed."));
      else set("image", data.url);
    } catch {
      setUploadError(t("Verbindungsfehler.", "Connection error."));
    }
    setUploading(false);
  }

  function save() {
    onSave({
      ...form,
      tags: tagText.split(",").map((x) => x.trim()).filter(Boolean),
      highlights: linesToList(highlightsDe),
      highlightsEn: linesToList(highlightsEn),
      gallery: linesToList(galleryText),
      specs: (form.specs ?? []).filter((s) => s.label.trim() && s.value.trim()),
      nutrition: nutritionValues(),
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center p-4 overflow-auto" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl w-full max-w-2xl p-6 my-8 relative">
        <button onClick={onClose} aria-label={t("Schließen", "Close")} className="absolute right-4 top-4 w-8 h-8 rounded-full bg-black/5 flex items-center justify-center">
          <X size={16} />
        </button>
        <h2 className="font-serif text-2xl mb-5">{form.id ? t("Produkt bearbeiten", "Edit product") : t("Produkt hinzufügen", "Add product")}</h2>

        <div className="grid gap-4">
          <Section title={t("Grunddaten", "Basics")}>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label={t("Name (Deutsch)", "Name (German)")}>
                <input value={form.name} onChange={(e) => set("name", e.target.value)} className="input" required aria-label={t("Name (Deutsch)", "Name (German)")} />
              </Field>
              <Field label={t("Name (Englisch)", "Name (English)")}>
                <input value={form.nameEn ?? ""} onChange={(e) => set("nameEn", e.target.value)} className="input" placeholder={t("leer = deutscher Name", "empty = German name")} />
              </Field>
              <Field label={t("Marke", "Brand")}>
                <input value={form.brand ?? ""} onChange={(e) => set("brand", e.target.value)} className="input" />
              </Field>
              <Field label={t("Kategorie", "Category")}>
                <input
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                  list="category-suggestions"
                  placeholder={t("z. B. Reis", "e.g. Rice")}
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
                <input value={form.badge ?? ""} onChange={(e) => set("badge", e.target.value)} placeholder={t("z. B. Neu", "e.g. New")} className="input" />
              </Field>
              <Field label={t("Einheit-Hinweis (optional)", "Unit note (optional)")}>
                <input value={form.unitNote ?? ""} onChange={(e) => set("unitNote", e.target.value)} placeholder={t("z. B. pro kg", "e.g. per kg")} className="input" />
              </Field>
            </div>
            <Field label={t("Tags (kommagetrennt)", "Tags (comma-separated)")}>
              <input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="Halal, Vegan" className="input" />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} />
              {t("Im Shop sichtbar", "Visible in the shop")}
            </label>
          </Section>

          <Section title={t("Foto", "Photo")}>
            <div className="flex gap-4 items-start">
              <div className="w-28 h-28 rounded-xl border border-black/10 bg-white flex items-center justify-center overflow-hidden shrink-0">
                {form.image ? <img src={sizedImage(form.image, 240)} alt="" className="w-full h-full object-contain" /> : <ImagePlus className="text-black/20" />}
              </div>
              <div className="grid gap-2 flex-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                />
                <button type="button" className="btn-outline w-fit" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                  {uploading ? t("Wird hochgeladen…", "Uploading…") : t("Foto hochladen", "Upload photo")}
                </button>
                <input value={form.image} onChange={(e) => set("image", e.target.value)} placeholder={t("…oder Bild-URL einfügen", "…or paste an image URL")} className="input" />
                {uploadError && <p className="text-xs text-red-700">{uploadError}</p>}
                <p className="text-[11px] text-black/40">
                  {t("Tipp: Produkt auf weißem Hintergrund fotografieren, ohne Preisschild.", "Tip: photograph the product on a white background, without a price sticker.")}
                </p>
              </div>
            </div>
            <Field label={t("Weitere Fotos (eine URL pro Zeile, optional)", "More photos (one URL per line, optional)")}>
              <textarea value={galleryText} onChange={(e) => setGalleryText(e.target.value)} className="input" rows={2} />
            </Field>
          </Section>

          <Section title={t("Beschreibung & Merkmale", "Description & highlights")}>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label={t("Beschreibung (Deutsch)", "Description (German)")}>
                <textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} className="input" rows={4} />
              </Field>
              <Field label={t("Beschreibung (Englisch)", "Description (English)")}>
                <textarea value={form.descriptionEn ?? ""} onChange={(e) => set("descriptionEn", e.target.value)} className="input" rows={4} />
              </Field>
              <Field label={t("Auf einen Blick (Deutsch)", "Highlights (German)")} hint={t("Ein Punkt pro Zeile", "One point per line")}>
                <textarea value={highlightsDe} onChange={(e) => setHighlightsDe(e.target.value)} className="input" rows={4} />
              </Field>
              <Field label={t("Auf einen Blick (Englisch)", "Highlights (English)")} hint={t("Ein Punkt pro Zeile", "One point per line")}>
                <textarea value={highlightsEn} onChange={(e) => setHighlightsEn(e.target.value)} className="input" rows={4} />
              </Field>
            </div>
          </Section>

          <Section title={t("Produktdetails (Tabelle)", "Product details (table)")}>
            {(form.specs ?? []).map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center">
                <input value={s.label} onChange={(e) => setSpec(i, { label: e.target.value })} placeholder={t("Merkmal DE", "Label DE")} className="input" />
                <input value={s.labelEn ?? ""} onChange={(e) => setSpec(i, { labelEn: e.target.value })} placeholder={t("Merkmal EN", "Label EN")} className="input" />
                <input value={s.value} onChange={(e) => setSpec(i, { value: e.target.value })} placeholder={t("Wert DE", "Value DE")} className="input" />
                <input value={s.valueEn ?? ""} onChange={(e) => setSpec(i, { valueEn: e.target.value })} placeholder={t("Wert EN", "Value EN")} className="input" />
                <button
                  type="button"
                  onClick={() => set("specs", (form.specs ?? []).filter((_, j) => j !== i))}
                  aria-label={t("Zeile entfernen", "Remove row")}
                  className="w-9 h-9 rounded-lg bg-black/5 flex items-center justify-center"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button type="button" className="btn-outline w-fit" onClick={() => set("specs", [...(form.specs ?? []), { label: "", value: "" }])}>
              <Plus size={13} /> {t("Zeile hinzufügen", "Add row")}
            </button>
          </Section>


          <Section title={t("Pflichtangaben Lebensmittel (Online-Verkauf)", "Required food information (online sales)")}>
            <p className="text-[11px] text-black/50 -mt-1">
              {t(
                "Gesetzlich vorgeschrieben (LMIV): Kunden müssen diese Angaben vor dem Kauf sehen. Einfach von der Packungsrückseite abschreiben. Pflichtfelder sind mit * markiert.",
                "Required by law (EU food information rules): customers must see this before buying. Copy it from the back of the pack. Required fields are marked *."
              )}
            </p>
            {missing.length > 0 ? (
              <div className="rounded-lg bg-red-50 text-red-700 text-xs px-3 py-2">
                {t("Noch offen: ", "Still missing: ")}
                {missing.map((m) => t(MISSING_LABELS[m].de, MISSING_LABELS[m].en)).join(", ")}
              </div>
            ) : (
              <div className="rounded-lg bg-green-50 text-green-800 text-xs px-3 py-2">{t("Alle Pflichtangaben sind ausgefüllt.", "All required information is filled in.")}</div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <Field
                label={t("Zutaten (Deutsch)", "Ingredients (German)")}
                required={!form.ingredientsNotRequired}
                hint={t("Allergene GROSS schreiben, z. B. WEIZENmehl, SESAM, Salz.", "Write allergens in CAPITALS, e.g. WEIZENmehl, SESAM, Salz.")}
              >
                <textarea value={form.ingredients ?? ""} onChange={(e) => set("ingredients", e.target.value)} className="input" rows={3} disabled={form.ingredientsNotRequired} />
              </Field>
              <Field label={t("Zutaten (Englisch, optional)", "Ingredients (English, optional)")}>
                <textarea value={form.ingredientsEn ?? ""} onChange={(e) => set("ingredientsEn", e.target.value)} className="input" rows={3} disabled={form.ingredientsNotRequired} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.ingredientsNotRequired} onChange={(e) => set("ingredientsNotRequired", e.target.checked)} />
              {t("Keine Zutatenliste nötig (Produkt besteht aus einer einzigen Zutat, z. B. Reis, Linsen, frisches Obst)", "No ingredient list needed (single-ingredient product, e.g. rice, lentils, fresh fruit)")}
            </label>

            <Field label={t("Allergene", "Allergens")} required hint={t("Alle zutreffenden ankreuzen, dann bestätigen, auch wenn keins enthalten ist.", "Tick all that apply, then confirm, even if none are present.")}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1">
                {ALLERGENS.map((a) => (
                  <label key={a.key} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.allergens.includes(a.key)} onChange={() => toggleAllergen(a.key)} />
                    {t(a.de, a.en)}
                  </label>
                ))}
              </div>
            </Field>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={form.allergensConfirmed} onChange={(e) => set("allergensConfirmed", e.target.checked)} />
              {form.allergens.length === 0
                ? t("Geprüft: enthält keine der 14 Hauptallergene", "Checked: contains none of the 14 main allergens")
                : t("Geprüft: Allergen-Angaben sind vollständig", "Checked: allergen information is complete")}
            </label>
            <Field label={t("Spuren (optional)", "Traces (optional)")}>
              <input value={form.traces ?? ""} onChange={(e) => set("traces", e.target.value)} placeholder={t("z. B. Kann Spuren von Erdnüssen enthalten.", "e.g. May contain traces of peanuts.")} className="input" />
            </Field>

            <Field label={t("Nährwerte je 100 g / 100 ml", "Nutrition per 100 g / 100 ml")} required={!form.nutritionNotRequired}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {NUTRIENTS.map((n) => (
                  <label key={n.key} className="text-[11px] text-black/50">
                    {t(n.de, n.en)} ({n.unit})
                    <input
                      inputMode="decimal"
                      value={nutritionText[n.key] ?? ""}
                      onChange={(e) => setNutritionText((cur) => ({ ...cur, [n.key]: e.target.value }))}
                      className="input mt-0.5"
                      disabled={form.nutritionNotRequired}
                      aria-label={t(n.de, n.en)}
                    />
                  </label>
                ))}
              </div>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.nutritionNotRequired} onChange={(e) => set("nutritionNotRequired", e.target.checked)} />
              {t("Keine Nährwerttabelle nötig (z. B. Gewürze, Kräuter, Tee, Kaffee, Salz, Einzelzutat)", "No nutrition table needed (e.g. spices, herbs, tea, coffee, salt, single ingredient)")}
            </label>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label={t("Hersteller / Importeur mit Anschrift", "Manufacturer / importer with address")} required>
                <textarea value={form.manufacturer ?? ""} onChange={(e) => set("manufacturer", e.target.value)} className="input" rows={2} placeholder={t("Name, Straße, PLZ Ort, Land", "Name, street, postcode city, country")} />
              </Field>
              <Field label={t("Herkunftsland (falls vorgeschrieben)", "Country of origin (where required)")} hint={t("Pflicht z. B. bei frischem Fleisch, Honig, Obst und Gemüse.", "Required e.g. for fresh meat, honey, fruit and vegetables.")}>
                <input value={form.origin ?? ""} onChange={(e) => set("origin", e.target.value)} className="input" />
              </Field>
              <Field label={t("Aufbewahrung (Deutsch)", "Storage (German)")} hint={t("Falls auf der Packung angegeben, z. B. Kühl lagern bei max. 7 °C.", "If shown on the pack, e.g. Keep refrigerated at max. 7 °C.")}>
                <input value={form.storage ?? ""} onChange={(e) => set("storage", e.target.value)} className="input" />
              </Field>
              <Field label={t("Aufbewahrung (Englisch, optional)", "Storage (English, optional)")}>
                <input value={form.storageEn ?? ""} onChange={(e) => set("storageEn", e.target.value)} className="input" />
              </Field>
            </div>
          </Section>

          <Section title={t("Größen, Preise & Bestand", "Sizes, prices & stock")}>
            {form.sizes.map((s, i) => (
              <div key={i} className="grid gap-2 pb-3 border-b border-black/5 last:border-0 last:pb-0">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-center">
                <input value={s.label} onChange={(e) => setSizeLabel(i, e.target.value)} placeholder={t("z. B. 500 g", "e.g. 500 g")} className="input" aria-label={t("Größe", "Size")} />
                <input type="number" step="0.01" min="0" value={s.price} onChange={(e) => setSize(i, { price: e.target.value })} placeholder={t("Preis €", "Price €")} className="input" aria-label={t("Preis", "Price")} />
                <input type="number" step="0.01" min="0" value={s.oldPrice ?? ""} onChange={(e) => setSize(i, { oldPrice: e.target.value })} placeholder={t("Vorher €", "Was €")} className="input" aria-label={t("Vorher-Preis", "Previous price")} />
                <input type="number" step="1" min="0" value={s.stock ?? ""} onChange={(e) => setSize(i, { stock: e.target.value })} placeholder={t("Bestand", "Stock")} className="input" aria-label={t("Bestand", "Stock")} />
                <button
                  type="button"
                  onClick={() => set("sizes", form.sizes.filter((_, j) => j !== i))}
                  aria-label={t("Größe entfernen", "Remove size")}
                  className="w-9 h-9 rounded-lg bg-black/5 flex items-center justify-center"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid grid-cols-[1fr_1fr_1fr_2fr] gap-2 items-center">
                <input
                  inputMode="decimal"
                  value={s.sizeValue ?? ""}
                  onChange={(e) => setSize(i, { sizeValue: e.target.value })}
                  placeholder={t("Nettomenge *", "Net quantity *")}
                  className="input"
                  aria-label={t("Nettomenge", "Net quantity")}
                />
                <select value={s.sizeUnit ?? ""} onChange={(e) => setSize(i, { sizeUnit: e.target.value || null })} className="input" aria-label={t("Einheit", "Unit")}>
                  <option value="">{t("Einheit *", "Unit *")}</option>
                  {SIZE_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u === "pcs" ? t("Stück", "pieces") : u}
                    </option>
                  ))}
                </select>
                <input
                  inputMode="decimal"
                  value={s.deposit != null && Number(s.deposit) !== 0 ? s.deposit : ""}
                  onChange={(e) => setSize(i, { deposit: e.target.value })}
                  placeholder={t("Pfand €", "Deposit €")}
                  className="input"
                  aria-label={t("Pfand", "Deposit")}
                />
                <span className="text-xs text-black/50">
                  {(() => {
                    const unit = formatUnitPrice(Number(String(s.price).replace(",", ".")), String(s.sizeValue ?? "").replace(",", "."), s.sizeUnit);
                    return unit ? t(`Grundpreis: ${unit}`, `Unit price: ${unit}`) : "";
                  })()}
                </span>
              </div>
              </div>
            ))}
            <p className="text-[11px] text-black/40">
              {t(
                "Nettomenge laut Packung (z. B. 500 g, 1,5 l), daraus wird der Grundpreis pro kg / l berechnet. Pfand nur bei Flaschen und Dosen (Einweg meist 0,25 €).",
                "Net quantity from the pack (e.g. 500 g, 1.5 l), used to calculate the price per kg / l. Deposit only for bottles and cans (single-use usually 0.25 €)."
              )}
            </p>
            <button type="button" onClick={() => set("sizes", [...form.sizes, { label: "", price: "" }])} className="btn-outline w-fit">
              <Plus size={13} /> {t("Weitere Größe hinzufügen", "Add another size")}
            </button>
          </Section>
        </div>

        {error && <div className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3 mt-4">{error}</div>}
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="btn-outline flex-1 justify-center">
            {t("Abbrechen", "Cancel")}
          </button>
          <button onClick={save} className="btn-primary flex-1 justify-center" disabled={uploading}>
            {t("Produkt speichern", "Save product")}
          </button>
        </div>
      </div>
    </div>
  );
}
