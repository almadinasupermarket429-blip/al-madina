"use client";

import { useState } from "react";
import { FileUp, Loader2, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

type Change = {
  variantId: string;
  name: string;
  price?: [number, number];
  oldPrice?: [number | null, number | null];
  stock?: [number, number];
  active?: [boolean, boolean];
  netQuantity?: [string, string];
  deposit?: [number, number];
  food?: string[];
};
type Result = { preview: boolean; rows: number; changes: Change[]; errors: string[] };

const eur = (n: number | null) => (n == null ? "–" : `€${n.toFixed(2)}`);

/** Upload an edited product spreadsheet: shows exactly what will change before saving. */
export function ImportDialog({ onClose, onApplied }: { onClose: () => void; onApplied: () => void }) {
  const { t } = useLanguage();
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(apply: boolean, text = csv) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/products/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: text, apply }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || t("Import fehlgeschlagen.", "Import failed."));
    setResult(data);
    if (!data.preview) onApplied();
  }

  async function pick(file: File) {
    const text = await file.text();
    setFileName(file.name);
    setCsv(text);
    setResult(null);
    send(false, text);
  }

  const applied = result && !result.preview;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center p-4 overflow-auto" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl w-full max-w-2xl p-6 my-8 relative">
        <button onClick={onClose} aria-label={t("Schließen", "Close")} className="absolute right-4 top-4 w-8 h-8 rounded-full bg-black/5 flex items-center justify-center">
          <X size={16} />
        </button>
        <h2 className="font-serif text-2xl mb-2">{t("Produkte importieren", "Import products")}</h2>
        <ol className="text-sm text-black/60 list-decimal pl-5 mb-4 grid gap-1">
          <li>{t("„Exportieren“ klicken und die Datei in Excel öffnen.", "Click “Export” and open the file in Excel.")}</li>
          <li>{t("Preis, Vorher-Preis, Bestand oder Sichtbar (ja/nein) ändern. Spalte „variant_id“ nicht ändern.", "Change price, previous price, stock or visible (ja/nein). Don't change the “variant_id” column.")}</li>
          <li>
            {t(
              "Pflichtangaben eintragen: Nettomenge + Einheit (g, kg, ml, l, stueck), Pfand, Zutaten, Allergene (z. B. „milch, sesam“), allergene_geprueft (ja/nein), Nährwerte je 100 g, Hersteller. Bei mehreren Größen zählt die erste Zeile des Produkts.",
              "Fill in the required info: net quantity + unit (g, kg, ml, l, stueck), deposit, ingredients, allergens (e.g. “milch, sesam”), allergene_geprueft (ja/nein), nutrition per 100 g, manufacturer. For products with several sizes, the first row of the product counts."
            )}
          </li>
          <li>{t("Als CSV speichern und hier hochladen. Sie sehen zuerst eine Vorschau.", "Save as CSV and upload it here. You'll see a preview first.")}</li>
        </ol>

        <label className="btn-outline w-fit cursor-pointer">
          <FileUp size={14} /> {fileName || t("CSV-Datei auswählen", "Choose CSV file")}
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
        </label>

        {busy && (
          <p className="text-sm text-black/50 mt-4 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> {t("Wird geprüft…", "Checking…")}
          </p>
        )}
        {error && <div className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3 mt-4">{error}</div>}

        {result && (
          <div className="mt-4">
            {result.errors.length > 0 && (
              <div className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3 mb-3">
                <b>{t(`${result.errors.length} Fehler — bitte korrigieren und erneut hochladen:`, `${result.errors.length} errors — please fix and upload again:`)}</b>
                <ul className="list-disc pl-5 mt-1">
                  {result.errors.slice(0, 20).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-sm mb-2">
              {applied
                ? t(`✅ ${result.changes.length} Änderungen gespeichert.`, `✅ ${result.changes.length} changes saved.`)
                : t(`${result.rows} Zeilen gelesen, ${result.changes.length} Änderungen:`, `${result.rows} rows read, ${result.changes.length} changes:`)}
            </p>
            {result.changes.length > 0 && (
              <div className="max-h-72 overflow-auto border border-black/10 rounded-xl">
                <table className="admin-table text-sm">
                  <tbody>
                    {result.changes.map((c) => (
                      <tr key={c.variantId}>
                        <td className="font-medium">{c.name}</td>
                        <td className="text-black/70">
                          {[
                            c.price && `${t("Preis", "Price")} ${eur(c.price[0])} → ${eur(c.price[1])}`,
                            c.oldPrice && `${t("Vorher", "Was")} ${eur(c.oldPrice[0])} → ${eur(c.oldPrice[1])}`,
                            c.stock && `${t("Bestand", "Stock")} ${c.stock[0]} → ${c.stock[1]}`,
                            c.active && (c.active[1] ? t("wird sichtbar", "becomes visible") : t("wird ausgeblendet", "becomes hidden")),
                            c.netQuantity && `${t("Nettomenge", "Net quantity")} ${c.netQuantity[0]} → ${c.netQuantity[1]}`,
                            c.deposit && `${t("Pfand", "Deposit")} ${eur(c.deposit[0])} → ${eur(c.deposit[1])}`,
                            c.food && `${t("Pflichtangaben", "Food info")}: ${c.food.join(", ")}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="btn-outline flex-1 justify-center">
            {applied ? t("Fertig", "Done") : t("Abbrechen", "Cancel")}
          </button>
          {!applied && (
            <button
              onClick={() => send(true)}
              className="btn-primary flex-1 justify-center"
              disabled={busy || !result || result.errors.length > 0 || result.changes.length === 0}
            >
              {t("Änderungen speichern", "Save changes")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
