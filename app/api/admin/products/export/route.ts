import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isOwner } from "@/lib/auth";
import { toCsv } from "@/lib/csv";

const IMPORT_HEADER = ["variant_id", "produkt", "groesse", "kategorie", "preis", "vorher_preis", "bestand", "sichtbar"];

type Row = {
  variant_id: string;
  product: string;
  size: string;
  category: string | null;
  price: string;
  old_price: string | null;
  stock: number;
  active: boolean;
};

// Owner only: every product size as a spreadsheet, for editing prices/stock in Excel
// and uploading again through /api/admin/products/import.
export async function GET() {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });

  const rows = await prisma.$queryRaw<Row[]>`
    select v.id as variant_id, p.name as product, v.size_label as size, c.name as category,
           v.price, v.compare_at_price as old_price, v.stock_quantity as stock, p.is_active as active
    from product_variants v
    join products p on p.id = v.product_id
    left join categories c on c.id = p.category_id
    where v.is_active
    order by coalesce(c.sort_order, 9999), p.sort_order, p.name, v.sort_order
  `;
  const comma = (n: string | null) => (n == null ? "" : Number(n).toFixed(2).replace(".", ","));
  const csv = toCsv([
    IMPORT_HEADER,
    ...rows.map((r) => [r.variant_id, r.product, r.size, r.category ?? "", comma(r.price), comma(r.old_price), r.stock, r.active ? "ja" : "nein"]),
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
