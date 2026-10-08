import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isOwner } from "@/lib/auth";
import { LOW_STOCK_THRESHOLD } from "@/lib/order-utils";

// Reads the live orders/order_items/product_variants schema. Cancelled
// orders never count toward revenue/units — only the status breakdown shows them.

type OrderRow = { id: string; total: string; discount: string; fulfillment: string; coupon_code: string | null; created_at: Date; berlin_hour: number; berlin_dow: number; berlin_day: string };
type ItemRow = { product_id: string | null; name: string; price: string; qty: number };
type LowStockRow = { id: string; productName: string; sizeLabel: string; stock: number };
type StatusCountRow = { status: string; count: bigint };

const RANGES = [7, 30, 90];

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });

  const requested = Number(req.nextUrl.searchParams.get("days"));
  const days = RANGES.includes(requested) ? requested : 30;
  const since = new Date(Date.now() - days * 86_400_000);
  const prevSince = new Date(Date.now() - 2 * days * 86_400_000);

  const [orders, prevTotals, items, lowStock, orderCountByStatus, newCustomers, cancelled] = await Promise.all([
    prisma.$queryRaw<OrderRow[]>`
      select id, total, discount, fulfillment, coupon_code, created_at,
             extract(hour from created_at at time zone 'Europe/Berlin')::int as berlin_hour,
             extract(dow from created_at at time zone 'Europe/Berlin')::int as berlin_dow,
             to_char(created_at at time zone 'Europe/Berlin', 'YYYY-MM-DD') as berlin_day
      from orders where created_at >= ${since} and status <> 'CANCELLED' order by created_at asc
    `,
    prisma.$queryRaw<{ revenue: string | null; orders: bigint }[]>`
      select sum(total) as revenue, count(*) as orders from orders
      where created_at >= ${prevSince} and created_at < ${since} and status <> 'CANCELLED'
    `,
    prisma.$queryRaw<ItemRow[]>`
      select oi.product_id, oi.name, oi.price, oi.qty
      from order_items oi
      join orders o on o.id = oi.order_id
      where o.created_at >= ${since} and o.status <> 'CANCELLED'
    `,
    prisma.$queryRaw<LowStockRow[]>`
      select pv.id, p.name as "productName", pv.size_label as "sizeLabel", pv.stock_quantity as stock
      from product_variants pv
      join products p on p.id = pv.product_id
      where pv.stock_quantity <= ${LOW_STOCK_THRESHOLD} and pv.is_active = true and p.is_active = true
      order by pv.stock_quantity asc
    `,
    // All-time status breakdown (not scoped to the range), matching the tabs on the orders dashboard.
    prisma.$queryRaw<StatusCountRow[]>`select status, count(*) as count from orders group by status`,
    prisma.$queryRaw<{ n: bigint }[]>`select count(*) as n from users where created_at >= ${since} and deleted_at is null`,
    prisma.$queryRaw<{ n: bigint }[]>`select count(*) as n from orders where created_at >= ${since} and status = 'CANCELLED'`,
  ]);

  // Revenue + order count per (Berlin) day, every day in range including empty ones.
  const byDay = new Map<string, { revenue: number; orders: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
    byDay.set(d, { revenue: 0, orders: 0 });
  }
  const byHour = Array.from({ length: 24 }, () => 0);
  const byWeekday = Array.from({ length: 7 }, () => ({ orders: 0, revenue: 0 }));
  const fulfillment = { DELIVERY: { orders: 0, revenue: 0 }, PICKUP: { orders: 0, revenue: 0 } };
  const coupons = new Map<string, { code: string; uses: number; discount: number }>();

  for (const o of orders) {
    const total = Number(o.total);
    const entry = byDay.get(o.berlin_day) ?? { revenue: 0, orders: 0 };
    entry.revenue += total;
    entry.orders += 1;
    byDay.set(o.berlin_day, entry);
    byHour[o.berlin_hour] += 1;
    byWeekday[o.berlin_dow].orders += 1;
    byWeekday[o.berlin_dow].revenue += total;
    const f = fulfillment[o.fulfillment as "DELIVERY" | "PICKUP"];
    if (f) {
      f.orders += 1;
      f.revenue += total;
    }
    if (o.coupon_code) {
      const c = coupons.get(o.coupon_code) ?? { code: o.coupon_code, uses: 0, discount: 0 };
      c.uses += 1;
      c.discount += Number(o.discount);
      coupons.set(o.coupon_code, c);
    }
  }
  const revenueByDay = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  // Top products by quantity sold.
  const qtyByProduct = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const it of items) {
    const key = it.product_id ?? it.name;
    const entry = qtyByProduct.get(key) ?? { name: it.name, qty: 0, revenue: 0 };
    entry.qty += it.qty;
    entry.revenue += Number(it.price) * it.qty;
    qtyByProduct.set(key, entry);
  }
  const topProducts = Array.from(qtyByProduct.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
  const prevRevenue = Number(prevTotals[0]?.revenue ?? 0);
  const prevOrders = Number(prevTotals[0]?.orders ?? 0);

  return NextResponse.json({
    days,
    totalRevenue,
    totalOrders: orders.length,
    averageOrderValue: orders.length ? totalRevenue / orders.length : 0,
    previous: { revenue: prevRevenue, orders: prevOrders, averageOrderValue: prevOrders ? prevRevenue / prevOrders : 0 },
    newCustomers: Number(newCustomers[0]?.n ?? 0),
    cancelledOrders: Number(cancelled[0]?.n ?? 0),
    totalDiscount: orders.reduce((s, o) => s + Number(o.discount), 0),
    ordersByStatus: orderCountByStatus.map((s) => ({ status: s.status, count: Number(s.count) })),
    revenueByDay,
    ordersByHour: byHour,
    ordersByWeekday: byWeekday,
    fulfillment,
    coupons: Array.from(coupons.values()).sort((a, b) => b.uses - a.uses),
    topProducts,
    lowStock: lowStock.map((s) => ({ id: s.id, productName: s.productName, sizeLabel: s.sizeLabel, stock: s.stock })),
  });
}
