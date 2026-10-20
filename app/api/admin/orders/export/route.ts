import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isOwner } from "@/lib/auth";
import { toCsv } from "@/lib/csv";

type Row = {
  order_number: string;
  created_at: Date;
  status: string;
  fulfillment: string;
  customer_name: string;
  subtotal: string;
  discount: string;
  coupon_code: string | null;
  delivery_fee: string;
  total: string;
  items: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Owner only: orders in a date range as a spreadsheet (e.g. for the accountant).
// ?from=2026-10-01&to=2026-10-31 (Berlin dates, inclusive). Defaults to the current month.
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });

  const now = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const fromParam = req.nextUrl.searchParams.get("from") ?? "";
  const toParam = req.nextUrl.searchParams.get("to") ?? "";
  const from = DATE.test(fromParam) ? fromParam : `${now.slice(0, 7)}-01`;
  const to = DATE.test(toParam) ? toParam : now;

  const rows = await prisma.$queryRaw<Row[]>`
    select o.order_number, o.created_at, o.status, o.fulfillment, o.customer_name, o.subtotal, o.discount, o.coupon_code,
           o.delivery_fee, o.total,
           string_agg(i.qty || '× ' || i.name || coalesce(' (' || i.size_label || ')', ''), ', ' order by i.name) as items
    from orders o left join order_items i on i.order_id = o.id
    where (o.created_at at time zone 'Europe/Berlin')::date between ${from}::date and ${to}::date
    group by o.id
    order by o.created_at
  `;
  const money = (n: string) => Number(n).toFixed(2).replace(".", ",");
  const when = (d: Date) => new Date(d).toLocaleString("de-DE", { timeZone: "Europe/Berlin" });
  const csv = toCsv([
    ["bestellnummer", "datum", "status", "art", "kunde", "zwischensumme", "rabatt", "gutschein", "liefergebuehr", "gesamt_bar", "artikel"],
    ...rows.map((r) => [
      r.order_number,
      when(r.created_at),
      r.status,
      r.fulfillment === "PICKUP" ? "Abholung" : "Lieferung",
      r.customer_name,
      money(r.subtotal),
      money(r.discount),
      r.coupon_code ?? "",
      money(r.delivery_fee),
      money(r.total),
      r.items ?? "",
    ]),
  ]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="al-madina-bestellungen-${from}-bis-${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
