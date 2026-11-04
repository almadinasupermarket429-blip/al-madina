// Shared by the storefront product modal (client) and the /products/[slug] page (server),
// so it takes ready-made strings and uses no hooks.
import { ALLERGENS, NUTRIENTS, formatUnitPrice, type FoodFactsData } from "@/lib/food-info";
import { formatEuro } from "@/lib/format";

export { ProductGallery } from "./ProductGallery";

export function ProductDetails({
  description,
  highlights,
  specs,
  t,
}: {
  description: string | null;
  highlights: string[];
  specs: { label: string; value: string }[];
  t: (de: string, en: string) => string;
}) {
  return (
    <div className="pd">
      {highlights.length > 0 && (
        <section>
          <h4>{t("Auf einen Blick", "About this item")}</h4>
          <ul className="pd-bullets">
            {highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>
      )}
      {description && (
        <section>
          <h4>{t("Beschreibung", "Description")}</h4>
          <p>{description}</p>
        </section>
      )}
      {specs.length > 0 && (
        <section>
          <h4>{t("Produktdetails", "Product details")}</h4>
          <table className="pd-specs">
            <tbody>
              {specs.map((s) => (
                <tr key={s.label}>
                  <th scope="row">{s.label}</th>
                  <td>{s.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

/** Price per kg / litre, bottle deposit and "incl. VAT", shown under every price (PAngV §§ 3, 4, 7). */
export function PriceNotes({
  price,
  sizeValue,
  sizeUnit,
  deposit,
  language,
  t,
}: {
  price: number;
  sizeValue?: number | null;
  sizeUnit?: string | null;
  deposit?: number | null;
  language: string;
  t: (de: string, en: string) => string;
}) {
  const unit = formatUnitPrice(price, sizeValue, sizeUnit, language);
  const parts = [
    unit && `${unit}`,
    deposit && deposit > 0 ? t(`zzgl. ${formatEuro(deposit, language)} Pfand`, `plus ${formatEuro(deposit, language)} deposit`) : "",
    t("inkl. MwSt.", "incl. VAT"),
  ].filter(Boolean);
  return <small className="price-notes">{parts.join(", ")}</small>;
}

/** Ingredients, allergens, nutrition and the rest of the mandatory food information (LMIV Art. 9). */
export function FoodFacts({ food, language, t }: { food: FoodFactsData; language: string; t: (de: string, en: string) => string }) {
  const en = language === "en";
  const ingredients = (en && food.ingredientsEn) || food.ingredients;
  const storage = (en && food.storageEn) || food.storage;
  const allergens = ALLERGENS.filter((a) => food.allergens?.includes(a.key));
  const nutrients = NUTRIENTS.filter((n) => food.nutrition?.[n.key] != null);
  const rows: { label: string; value: string }[] = [
    ingredients ? { label: t("Zutaten", "Ingredients"), value: ingredients } : null,
    food.allergensConfirmed
      ? {
          label: t("Allergene", "Allergens"),
          value: allergens.length
            ? allergens.map((a) => (en ? a.en : a.de)).join(", ")
            : t("Enthält keines der 14 Hauptallergene.", "Contains none of the 14 major allergens."),
        }
      : null,
    food.traces ? { label: t("Kann Spuren enthalten von", "May contain traces of"), value: food.traces } : null,
    storage ? { label: t("Aufbewahrung", "Storage"), value: storage } : null,
    food.origin ? { label: t("Herkunft", "Origin"), value: food.origin } : null,
    food.manufacturer ? { label: t("Hersteller / Importeur", "Manufacturer / importer"), value: food.manufacturer } : null,
  ].filter((r): r is { label: string; value: string } => r !== null);

  if (rows.length === 0 && nutrients.length === 0) return null;
  const number = (n: number) => n.toLocaleString(en ? "en-GB" : "de-DE", { maximumFractionDigits: 1 });

  return (
    <div className="pd">
      {rows.length > 0 && (
        <section>
          <h4>{t("Lebensmittelinformationen", "Food information")}</h4>
          <table className="pd-specs">
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  <td>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {nutrients.length > 0 && (
        <section>
          <h4>{t("Nährwerte pro 100 g / 100 ml", "Nutrition per 100 g / 100 ml")}</h4>
          <table className="pd-specs">
            <tbody>
              {nutrients.map((n) => (
                <tr key={n.key}>
                  <th scope="row">{en ? n.en : n.de}</th>
                  <td>
                    {number(food.nutrition![n.key]!)} {n.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
