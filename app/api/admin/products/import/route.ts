import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isOwner } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";
import { parseCsv, parseDecimal } from "@/lib/csv";

type Change = { variantId: string; name: string; price?: [number, number]; oldPrice?: [number | null, number | null]; stock?: [number, number]; active?: [boolean, boolean] };
type Current = { id: string; product_id: string; name: string; price: string; old_price: string | null; stock: number; active: boolean };

const yes = (v: string) => ["ja", "yes", "true", "1", "x"].includes(v.trim().toLowerCase());
const no = (v: string) => ["nein", "no", "false", "0", ""].includes(v.trim().toLowerCase());

// Owner only: upload the CSV from /api/admin/products/export after editing it.
// Only price, previous price, stock and visibility are applied; rows are matched by variant_id.
// Send { csv, apply: false } first to preview the changes, then { csv, apply: true } to save them.
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  if (typeof body.csv !== "string" || body.csv.length > 2_000_000) return NextResponse.json({ error: "Bitte eine CSV-Datei hochladen." }, { status: 400 });

  const rows = parseCsv(body.csv);
  const header = (rows.shift() ?? []).map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const [iId, iPrice, iOld, iStock, iActive] = ["variant_id", "preis", "vorher_preis", "bestand", "sichtbar"].map(col);
  if (iId < 0) return NextResponse.json({ error: "Spalte „variant_id“ fehlt. Bitte die exportierte Datei verwenden." }, { status: 400 });

  const ids = rows.map((r) => r[iId]?.trim()).filter((x): x is string => !!x && /^[0-9a-f-]{36}$/i.test(x));
  const current = await prisma.$queryRaw<Current[]>`
    select v.id, v.product_id, p.name || ' (' || v.size_label || ')' as name, v.price, v.compare_at_price as old_price,
           v.stock_quantity as stock, p.is_active as active
    from product_variants v join products p on p.id = v.product_id
    where v.id = any(${ids}::uuid[])
  `;
  const byId = new Map(current.map((c) => [c.id, c]));

  const changes: Change[] = [];
  const errors: string[] = [];
  rows.forEach((r, i) => {
    const line = i + 2;
    const cur = byId.get(r[iId]?.trim() ?? "");
    if (!cur) {
      errors.push(`Zeile ${line}: unbekannte variant_id`);
      return;
    }
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
    if (change.price || change.oldPrice || change.stock || change.active) changes.push(change);
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
  });
  await logAdminAction(session, "product.import", "product", null, `CSV-Import: ${changes.length} Änderungen`, { changes: changes.slice(0, 200) });
  return NextResponse.json({ preview: false, rows: rows.length, changes, errors: [] });
}
