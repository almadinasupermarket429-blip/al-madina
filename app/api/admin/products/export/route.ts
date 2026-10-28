import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isOwner } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { NUTRIENTS, NUTRIENT_CSV, allergenCsv, type Nutrition } from "@/lib/food-info";

// Columns the import understands. Product-level food information repeats on every size row
// of a product; on import the first row of each product is used.
const IMPORT_HEADER = [
  "variant_id",
  "produkt",
  "groesse",
  "kategorie",
  "preis",
  "vorher_preis",
  "bestand",
  "sichtbar",
  "nettomenge",
  "einheit",
  "pfand",
  "zutaten",
  "zutaten_nicht_noetig",
  "allergene",
  "allergene_geprueft",
  "spuren",
  ...NUTRIENTS.map((n) => NUTRIENT_CSV[n.key]),
  "naehrwerte_nicht_noetig",
  "hersteller",
  "herkunft",
  "aufbewahrung",
];

type Row = {
  variant_id: string;
  product: string;
  size: string;
  category: string | null;
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

// Owner only: every product size as a spreadsheet, for editing prices/stock and the
// mandatory food information in Excel, then uploading again through /api/admin/products/import.
export async function GET() {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });

  const rows = await prisma.$queryRaw<Row[]>`
    select v.id as variant_id, p.name as product, v.size_label as size, c.name as category,
           v.price, v.compare_at_price as old_price, v.stock_quantity as stock, p.is_active as active,
           v.size_value, v.size_unit::text as size_unit, v.deposit,
           p.ingredients, p.ingredients_not_required, p.allergens, p.allergens_confirmed, p.traces,
           p.nutrition, p.nutrition_not_required, p.manufacturer, p.origin, p.storage
    from product_variants v
    join products p on p.id = v.product_id
    left join categories c on c.id = p.category_id
    where v.is_active
    order by coalesce(c.sort_order, 9999), p.sort_order, p.name, v.sort_order
  `;
  const comma = (n: string | number | null | undefined, digits = 2) => (n == null || n === "" ? "" : Number(n).toFixed(digits).replace(".", ","));
  const plain = (n: string | number | null | undefined) => (n == null || n === "" ? "" : String(Number(n)).replace(".", ","));
  const yesNo = (b: boolean) => (b ? "ja" : "nein");
  const csv = toCsv([
    IMPORT_HEADER,
    ...rows.map((r) => [
      r.variant_id,
      r.product,
      r.size,
      r.category ?? "",
      comma(r.price),
      comma(r.old_price),
      r.stock,
      yesNo(r.active),
      plain(r.size_value),
      r.size_unit === "pcs" ? "stueck" : (r.size_unit ?? ""),
      Number(r.deposit) > 0 ? comma(r.deposit) : "",
      r.ingredients ?? "",
      yesNo(r.ingredients_not_required),
      allergenCsv(r.allergens),
      yesNo(r.allergens_confirmed),
      r.traces ?? "",
      ...NUTRIENTS.map((n) => plain(r.nutrition?.[n.key])),
      yesNo(r.nutrition_not_required),
      r.manufacturer ?? "",
      r.origin ?? "",
      r.storage ?? "",
    ]),
  ]);
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="al-madina-produkte-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
