// Mandatory food information for online sales (EU Regulation 1169/2011 "LMIV", Art. 9 + 14):
// customers must see it before they buy. Also the price per kg / litre (German PAngV § 4)
// and the bottle deposit (PAngV § 7). Shared by the admin (what is still missing) and,
// later, the shop pages.

/** The 14 allergens that must be declared (LMIV Annex II). Keys are stored in products.allergens. */
export const ALLERGENS = [
  { key: "gluten", csv: "gluten", de: "Glutenhaltiges Getreide", en: "Cereals containing gluten" },
  { key: "crustaceans", csv: "krebstiere", de: "Krebstiere", en: "Crustaceans" },
  { key: "eggs", csv: "eier", de: "Eier", en: "Eggs" },
  { key: "fish", csv: "fisch", de: "Fisch", en: "Fish" },
  { key: "peanuts", csv: "erdnuesse", de: "Erdnüsse", en: "Peanuts" },
  { key: "soy", csv: "soja", de: "Soja", en: "Soybeans" },
  { key: "milk", csv: "milch", de: "Milch (inkl. Laktose)", en: "Milk (incl. lactose)" },
  { key: "nuts", csv: "nuesse", de: "Schalenfrüchte (Nüsse)", en: "Tree nuts" },
  { key: "celery", csv: "sellerie", de: "Sellerie", en: "Celery" },
  { key: "mustard", csv: "senf", de: "Senf", en: "Mustard" },
  { key: "sesame", csv: "sesam", de: "Sesam", en: "Sesame" },
  { key: "sulphites", csv: "sulfite", de: "Schwefeldioxid und Sulfite", en: "Sulphur dioxide and sulphites" },
  { key: "lupin", csv: "lupinen", de: "Lupinen", en: "Lupin" },
  { key: "molluscs", csv: "weichtiere", de: "Weichtiere", en: "Molluscs" },
] as const;

export const ALLERGEN_KEYS: readonly string[] = ALLERGENS.map((a) => a.key);

/** The nutrition declaration per 100 g / 100 ml, in the order the label shows it (LMIV Art. 30). */
export const NUTRIENTS = [
  { key: "energyKj", de: "Energie (kJ)", en: "Energy (kJ)", unit: "kJ" },
  { key: "energyKcal", de: "Energie (kcal)", en: "Energy (kcal)", unit: "kcal" },
  { key: "fat", de: "Fett", en: "Fat", unit: "g" },
  { key: "saturates", de: "davon gesättigte Fettsäuren", en: "of which saturates", unit: "g" },
  { key: "carbs", de: "Kohlenhydrate", en: "Carbohydrate", unit: "g" },
  { key: "sugars", de: "davon Zucker", en: "of which sugars", unit: "g" },
  { key: "protein", de: "Eiweiß", en: "Protein", unit: "g" },
  { key: "salt", de: "Salz", en: "Salt", unit: "g" },
] as const;

export type NutrientKey = (typeof NUTRIENTS)[number]["key"];
export type Nutrition = Partial<Record<NutrientKey, number>>;

/** Spreadsheet column names for the nutrition values. */
export const NUTRIENT_CSV: Record<NutrientKey, string> = {
  energyKj: "energie_kj",
  energyKcal: "energie_kcal",
  fat: "fett",
  saturates: "ges_fettsaeuren",
  carbs: "kohlenhydrate",
  sugars: "zucker",
  protein: "eiweiss",
  salt: "salz",
};

/** "milch, sesam" (spreadsheet) -> ["milk", "sesame"]; unknown words are returned in `unknown`. */
export function parseAllergenList(text: string): { keys: string[]; unknown: string[] } {
  const keys: string[] = [];
  const unknown: string[] = [];
  for (const word of text.split(/[,;]/).map((w) => w.trim().toLowerCase()).filter(Boolean)) {
    const a = ALLERGENS.find((x) => x.csv === word || x.key === word || x.de.toLowerCase() === word);
    if (!a) unknown.push(word);
    else if (!keys.includes(a.key)) keys.push(a.key);
  }
  return { keys, unknown };
}

/** ["milk", "sesame"] -> "milch, sesam" */
export const allergenCsv = (keys: string[] | null | undefined) =>
  (keys ?? []).map((k) => ALLERGENS.find((a) => a.key === k)?.csv ?? k).join(", ");


export const SIZE_UNITS = ["g", "kg", "ml", "l", "pcs"] as const;
export type SizeUnit = (typeof SIZE_UNITS)[number];

export type FoodInfo = {
  ingredients?: string | null;
  ingredientsNotRequired?: boolean | null;
  allergens?: string[] | null;
  allergensConfirmed?: boolean | null;
  nutrition?: Nutrition | null;
  nutritionNotRequired?: boolean | null;
  manufacturer?: string | null;
  sizes?: { label?: string; sizeValue?: number | string | null; sizeUnit?: string | null }[];
};

export type MissingField = "ingredients" | "allergens" | "nutrition" | "manufacturer" | "netQuantity";

export const MISSING_LABELS: Record<MissingField, { de: string; en: string }> = {
  ingredients: { de: "Zutaten", en: "Ingredients" },
  allergens: { de: "Allergene", en: "Allergens" },
  nutrition: { de: "Nährwerte", en: "Nutrition" },
  manufacturer: { de: "Hersteller", en: "Manufacturer" },
  netQuantity: { de: "Nettomenge", en: "Net quantity" },
};

const filled = (v: unknown) => typeof v === "string" && v.trim().length > 0;
const isNumber = (v: unknown) => v !== null && v !== "" && v !== undefined && Number.isFinite(Number(v));

/** Which mandatory details a product still lacks. Empty = ready to sell online. */
export function missingFoodInfo(p: FoodInfo): MissingField[] {
  const missing: MissingField[] = [];
  if (!p.ingredientsNotRequired && !filled(p.ingredients)) missing.push("ingredients");
  // An empty allergen list is a valid answer ("contains none"), but only once someone has confirmed it.
  if (!p.allergensConfirmed) missing.push("allergens");
  if (!p.nutritionNotRequired && !NUTRIENTS.every((n) => isNumber(p.nutrition?.[n.key]))) missing.push("nutrition");
  if (!filled(p.manufacturer)) missing.push("manufacturer");
  const sizes = p.sizes ?? [];
  if (sizes.length === 0 || sizes.some((s) => !(isNumber(s.sizeValue) && Number(s.sizeValue) > 0 && SIZE_UNITS.includes(s.sizeUnit as SizeUnit)))) {
    missing.push("netQuantity");
  }
  return missing;
}

/** Reads a size label like "500 g", "1,5 l", "25cl" or "2 kg" into a value + unit. "1 Stück" → null. */
export function parseSizeLabel(label: string | null | undefined): { value: number; unit: SizeUnit } | null {
  const m = (label ?? "").match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l)(?![a-zäöü])/i);
  if (!m) return null;
  const value = Number(m[1].replace(",", "."));
  if (!(value > 0)) return null;
  const unit = m[2].toLowerCase();
  if (unit === "cl") return { value: value * 10, unit: "ml" };
  return { value, unit: unit as SizeUnit };
}

/**
 * Price per kg or per litre (PAngV § 4 uses 1 kg / 1 l). Null for items sold by the piece
 * or without a known net quantity.
 */
export function unitPrice(price: number, sizeValue: number | string | null | undefined, sizeUnit: string | null | undefined): { amount: number; per: "kg" | "l" } | null {
  const value = Number(sizeValue);
  if (!(value > 0) || !(price >= 0)) return null;
  const factor: Record<string, [number, "kg" | "l"]> = { g: [1000, "kg"], kg: [1, "kg"], ml: [1000, "l"], l: [1, "l"] };
  const f = sizeUnit ? factor[sizeUnit] : undefined;
  if (!f) return null;
  return { amount: Math.round((price * f[0]) / value * 100) / 100, per: f[1] };
}

/** "4,98 €/kg" */
export function formatUnitPrice(price: number, sizeValue: number | string | null | undefined, sizeUnit: string | null | undefined): string {
  const u = unitPrice(price, sizeValue, sizeUnit);
  return u ? `${u.amount.toFixed(2).replace(".", ",")} €/${u.per}` : "";
}
