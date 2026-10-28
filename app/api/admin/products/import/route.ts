import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isOwner } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";
import { parseCsv, parseDecimal } from "@/lib/csv";
import { NUTRIENTS, NUTRIENT_CSV, parseAllergenList, type Nutrition, type SizeUnit } from "@/lib/food-info";

type Change = {
  variantId: string;
  name: string;
  price?: [number, number];
  oldPrice?: [number | null, number | null];
  stock?: [number, number];
  active?: [boolean, boolean];
  netQuantity?: [string, string];
  deposit?: [number, number];
  /** Names of the food-information fields that change on this product. */
  food?: string[];
};

type Current = {
  id: string;
  product_id: string;
  name: string;
  price: string;
  old_price: string | null;
  stock: number;
  active: boolean;
  size_value: string | null;
  size_unit: string | null;
  deposit: string;
  ingredients: string | null;
  ingredients_not_required: boolean;
  allergens: string[];
  allergens_confirmed: boolean;
  traces: string | null;
  nutrition: Nutrition | null;
  nutrition_not_required: boolean;
  manufacturer: string | null;
  origin: string | null;
  storage: string | null;
};

type Food = Pick<
  Current,
  "ingredients" | "ingredients_not_required" | "allergens" | "allergens_confirmed" | "traces" | "nutrition" | "nutrition_not_required" | "manufacturer" | "origin" | "storage"
>;

const yes = (v: string) => ["ja", "yes", "true", "1", "x"].includes(v.trim().toLowerCase());
const no = (v: string) => ["nein", "no", "false", "0", ""].includes(v.trim().toLowerCase());
const UNITS: Record<string, SizeUnit> = { g: "g", kg: "kg", ml: "ml", l: "l", stueck: "pcs", "stück": "pcs", stk: "pcs", pcs: "pcs" };
const qty = (value: number | null, unit: string | null) => (value == null || !unit ? "–" : `${value} ${unit === "pcs" ? "Stück" : unit}`);
const sameNutrition = (a: Nutrition | null, b: Nutrition | null) => NUTRIENTS.every((n) => (a?.[n.key] ?? null) === (b?.[n.key] ?? null));

// Human-readable names of the food fields, for the preview.
const FOOD_LABELS: Record<keyof Food, string> = {
  ingredients: "Zutaten",
  ingredients_not_required: "Zutaten nicht nötig",
  allergens: "Allergene",
  allergens_confirmed: "Allergene geprüft",
  traces: "Spuren",
  nutrition: "Nährwerte",
  nutrition_not_required: "Nährwerte nicht nötig",
  manufacturer: "Hersteller",
  origin: "Herkunft",
  storage: "Aufbewahrung",
};

// Owner only: upload the CSV from /api/admin/products/export after editing it.
// Applies price, previous price, stock, visibility, net quantity, deposit and the mandatory
// food information; rows are matched by variant_id. Only columns present in the file are used.
// Send { csv, apply: false } first to preview the changes, then { csv, apply: true } to save them.
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  if (typeof body.csv !== "string" || body.csv.length > 5_000_000) return NextResponse.json({ error: "Bitte eine CSV-Datei hochladen." }, { status: 400 });

  const rows = parseCsv(body.csv);
  const header = (rows.shift() ?? []).map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const [iId, iPrice, iOld, iStock, iActive, iQty, iUnit, iDeposit] = ["variant_id", "preis", "vorher_preis", "bestand", "sichtbar", "nettomenge", "einheit", "pfand"].map(col);
  const iFood = {
    ingredients: col("zutaten"),
    ingredientsNot: col("zutaten_nicht_noetig"),
    allergens: col("allergene"),
    allergensOk: col("allergene_geprueft"),
    traces: col("spuren"),
    nutritionNot: col("naehrwerte_nicht_noetig"),
    manufacturer: col("hersteller"),
    origin: col("herkunft"),
    storage: col("aufbewahrung"),
  };
  const iNutrients = NUTRIENTS.map((n) => ({ key: n.key, i: col(NUTRIENT_CSV[n.key]) }));
  if (iId < 0) return NextResponse.json({ error: "Spalte „variant_id“ fehlt. Bitte die exportierte Datei verwenden." }, { status: 400 });

  const ids = rows.map((r) => r[iId]?.trim()).filter((x): x is string => !!x && /^[0-9a-f-]{36}$/i.test(x));
  const current = await prisma.$queryRaw<Current[]>`
    select v.id, v.product_id, p.name || ' (' || v.size_label || ')' as name, v.price, v.compare_at_price as old_price,
           v.stock_quantity as stock, p.is_active as active, v.size_value, v.size_unit::text as size_unit, v.deposit,
           p.ingredients, p.ingredients_not_required, p.allergens, p.allergens_confirmed, p.traces,
           p.nutrition, p.nutrition_not_required, p.manufacturer, p.origin, p.storage
    from product_variants v join products p on p.id = v.product_id
    where v.id = any(${ids}::uuid[])
  `;
  const byId = new Map(current.map((c) => [c.id, c]));

  const changes: Change[] = [];
  const errors: string[] = [];
  const sizeUpdates = new Map<string, { value: number | null; unit: SizeUnit | null }>();
  const depositUpdates = new Map<string, number>();
  const foodUpdates = new Map<string, Food>();
  const seenProducts = new Set<string>();

  rows.forEach((r, i) => {
    const line = i + 2;
    const cur = byId.get(r[iId]?.trim() ?? "");
    if (!cur) {
      errors.push(`Zeile ${line}: unbekannte variant_id`);
      return;
    }
    const cell = (idx: number) => (idx >= 0 ? (r[idx] ?? "").trim() : "");
    const change: Change = { variantId: cur.id, name: cur.name };
    if (iPrice >= 0) {
      const p = parseDecimal(r[iPrice]);
      if (p == null || p < 0 || p > 10_000) errors.push(`Zeile ${line}: ungültiger Preis „${r[iPrice] ?? ""}“`);
      else if (p !== Number(cur.price)) change.price = [Number(cur.price), p];
    }
    if (iOld >= 0) {
      const o = parseDecimal(r[iOld]);
      const before = cur.old_price == null ? null : Number(cur.old_price);
      if (o != null && (o < 0 || o > 10_000)) errors.push(`Zeile ${line}: ungültiger Vorher-Preis`);
      else if (o !== before) change.oldPrice = [before, o];
    }
    if (iStock >= 0) {
      const s = Number((r[iStock] ?? "").trim());
      if (!Number.isInteger(s) || s < 0 || s > 100_000) errors.push(`Zeile ${line}: ungültiger Bestand „${r[iStock] ?? ""}“`);
      else if (s !== cur.stock) change.stock = [cur.stock, s];
    }
    if (iActive >= 0) {
      const v = r[iActive] ?? "";
      if (!yes(v) && !no(v)) errors.push(`Zeile ${line}: „sichtbar“ muss ja oder nein sein`);
      else if (yes(v) !== cur.active) change.active = [cur.active, yes(v)];
    }

    // Net quantity: both cells filled, or both empty.
    if (iQty >= 0 && iUnit >= 0) {
      const rawQty = cell(iQty);
      const rawUnit = cell(iUnit).toLowerCase();
      const value = rawQty ? parseDecimal(rawQty) : null;
      const unit = rawUnit ? UNITS[rawUnit] : null;
      if (rawQty && (value == null || value <= 0 || value >= 1_000_000)) errors.push(`Zeile ${line}: ungültige Nettomenge „${rawQty}“`);
      else if (rawUnit && !unit) errors.push(`Zeile ${line}: Einheit muss g, kg, ml, l oder stueck sein`);
      else if (!!rawQty !== !!rawUnit) errors.push(`Zeile ${line}: Nettomenge und Einheit bitte zusammen angeben`);
      else {
        const before = cur.size_value == null ? null : Number(cur.size_value);
        if (value !== before || unit !== cur.size_unit) {
          change.netQuantity = [qty(before, cur.size_unit), qty(value, unit)];
          sizeUpdates.set(cur.id, { value, unit });
        }
      }
    }
    if (iDeposit >= 0) {
      const raw = cell(iDeposit);
      const d = raw ? parseDecimal(raw) : 0;
      if (d == null || d < 0 || d >= 100) errors.push(`Zeile ${line}: ungültiges Pfand „${raw}“`);
      else if (d !== Number(cur.deposit)) {
        change.deposit = [Number(cur.deposit), d];
        depositUpdates.set(cur.id, d);
      }
    }

    // Food information belongs to the product: read it from the product's first row only.
    if (!seenProducts.has(cur.product_id)) {
      seenProducts.add(cur.product_id);
      const next: Food = {
        ingredients: cur.ingredients,
        ingredients_not_required: cur.ingredients_not_required,
        allergens: cur.allergens,
        allergens_confirmed: cur.allergens_confirmed,
        traces: cur.traces,
        nutrition: cur.nutrition,
        nutrition_not_required: cur.nutrition_not_required,
        manufacturer: cur.manufacturer,
        origin: cur.origin,
        storage: cur.storage,
      };
      const textCell = (idx: number, max: number) => cell(idx).slice(0, max) || null;
      const flag = (idx: number, name: string): boolean | undefined => {
        const v = cell(idx);
        if (!yes(v) && !no(v)) {
          errors.push(`Zeile ${line}: „${name}“ muss ja oder nein sein`);
          return undefined;
        }
        return yes(v);
      };
      if (iFood.ingredients >= 0) next.ingredients = textCell(iFood.ingredients, 4000);
      if (iFood.ingredientsNot >= 0) next.ingredients_not_required = flag(iFood.ingredientsNot, "zutaten_nicht_noetig") ?? next.ingredients_not_required;
      if (iFood.allergens >= 0) {
        const { keys, unknown } = parseAllergenList(cell(iFood.allergens));
        if (unknown.length) errors.push(`Zeile ${line}: unbekannte Allergene „${unknown.join(", ")}“ (erlaubt: gluten, krebstiere, eier, fisch, erdnuesse, soja, milch, nuesse, sellerie, senf, sesam, sulfite, lupinen, weichtiere)`);
        else next.allergens = keys;
      }
      if (iFood.allergensOk >= 0) next.allergens_confirmed = flag(iFood.allergensOk, "allergene_geprueft") ?? next.allergens_confirmed;
      if (iFood.traces >= 0) next.traces = textCell(iFood.traces, 500);
      if (iNutrients.some((n) => n.i >= 0)) {
        const nutrition: Nutrition = { ...(cur.nutrition ?? {}) };
        for (const n of iNutrients) {
          if (n.i < 0) continue;
          const raw = cell(n.i);
          if (!raw) {
            delete nutrition[n.key];
            continue;
          }
          const v = parseDecimal(raw);
          if (v == null || v < 0 || v >= 10_000) errors.push(`Zeile ${line}: ungültiger Nährwert „${raw}“ in Spalte ${NUTRIENT_CSV[n.key]}`);
          else nutrition[n.key] = Math.round(v * 100) / 100;
        }
        next.nutrition = Object.keys(nutrition).length ? nutrition : null;
      }
      if (iFood.nutritionNot >= 0) next.nutrition_not_required = flag(iFood.nutritionNot, "naehrwerte_nicht_noetig") ?? next.nutrition_not_required;
      if (iFood.manufacturer >= 0) next.manufacturer = textCell(iFood.manufacturer, 500);
      if (iFood.origin >= 0) next.origin = textCell(iFood.origin, 200);
      if (iFood.storage >= 0) next.storage = textCell(iFood.storage, 500);

      const changed = (Object.keys(FOOD_LABELS) as (keyof Food)[]).filter((k) => {
        if (k === "nutrition") return !sameNutrition(cur.nutrition, next.nutrition);
        if (k === "allergens") return [...cur.allergens].sort().join() !== [...next.allergens].sort().join();
        return cur[k] !== next[k];
      });
      if (changed.length) {
        change.food = changed.map((k) => FOOD_LABELS[k]);
        foodUpdates.set(cur.product_id, next);
      }
    }

    if (change.price || change.oldPrice || change.stock || change.active || change.netQuantity || change.deposit || change.food) changes.push(change);
  });

  if (!body.apply || errors.length > 0) {
    return NextResponse.json({ preview: true, rows: rows.length, changes, errors });
  }

  await prisma.$transaction(async (tx) => {
    for (const c of changes) {
      if (c.price) await tx.$executeRaw`update product_variants set price = ${c.price[1]} where id = ${c.variantId}::uuid`;
      if (c.oldPrice) await tx.$executeRaw`update product_variants set compare_at_price = ${c.oldPrice[1]} where id = ${c.variantId}::uuid`;
      if (c.stock) await tx.$executeRaw`update product_variants set stock_quantity = ${c.stock[1]} where id = ${c.variantId}::uuid`;
      if (c.active) {
        await tx.$executeRaw`update products set is_active = ${c.active[1]} where id = (select product_id from product_variants where id = ${c.variantId}::uuid)`;
      }
    }
    for (const [id, s] of sizeUpdates) {
      await tx.$executeRaw`update product_variants set size_value = ${s.value}, size_unit = ${s.unit}::variant_size_unit where id = ${id}::uuid`;
    }
    for (const [id, d] of depositUpdates) {
      await tx.$executeRaw`update product_variants set deposit = ${d} where id = ${id}::uuid`;
    }
    for (const [id, f] of foodUpdates) {
      await tx.$executeRaw`
        update products set
          ingredients = ${f.ingredients}, ingredients_not_required = ${f.ingredients_not_required},
          allergens = ${f.allergens}::text[], allergens_confirmed = ${f.allergens_confirmed}, traces = ${f.traces},
          nutrition = ${f.nutrition ? JSON.stringify(f.nutrition) : null}::jsonb, nutrition_not_required = ${f.nutrition_not_required},
          manufacturer = ${f.manufacturer}, origin = ${f.origin}, storage = ${f.storage}, updated_at = now()
        where id = ${id}::uuid
      `;
    }
  }, { timeout: 60_000 });
  await logAdminAction(session, "product.import", "product", null, `CSV-Import: ${changes.length} Änderungen`, { changes: changes.slice(0, 200) });
  return NextResponse.json({ preview: false, rows: rows.length, changes, errors: [] });
}
