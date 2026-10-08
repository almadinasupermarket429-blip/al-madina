import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isUuid } from "@/lib/orders";

type RelatedProduct = { id: string; name: string; image: string | null; category: string | null };

// Public: "customers who bought this also bought" — derived from real order history,
// not a separate recommendation model. Falls back to same-category products if this
// item has no order history yet (e.g. it's brand new).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Produkt nicht gefunden." }, { status: 404 });

  const product = await prisma.$queryRaw<{ id: string; category_id: string | null }[]>`
    select id, category_id from products where id = ${id}::uuid
  `;
  if (!product[0]) return NextResponse.json({ error: "Produkt nicht gefunden." }, { status: 404 });

  // Orders that contained this product.
  const coOrdered = await prisma.$queryRaw<{ order_id: string }[]>`
    select distinct order_id from order_items where product_id = ${id}::uuid
  `;
  const orderIds = coOrdered.map((o) => o.order_id);

  let related: RelatedProduct[] = [];

  if (orderIds.length > 0) {
    const topCoOrdered = await prisma.$queryRaw<{ product_id: string }[]>`
      select product_id
      from order_items
      where order_id = any(${orderIds}::uuid[]) and product_id is not null and product_id != ${id}::uuid
      group by product_id
      order by count(*) desc
      limit 6
    `;
    const topIds = topCoOrdered.map((r) => r.product_id);

    if (topIds.length > 0) {
      const products = await prisma.$queryRaw<RelatedProduct[]>`
        select p.id, p.name, p.image_url as image, c.name as category
        from products p
        left join categories c on c.id = p.category_id
        where p.id = any(${topIds}::uuid[]) and p.is_active = true
      `;
      // Keep the "most frequently bought together" ordering.
      related = topIds.map((pid) => products.find((p) => p.id === pid)).filter((p): p is RelatedProduct => Boolean(p));
    }
  }

  if (related.length === 0) {
    related = await prisma.$queryRaw<RelatedProduct[]>`
      select p.id, p.name, p.image_url as image, c.name as category
      from products p
      left join categories c on c.id = p.category_id
      where p.category_id is not distinct from ${product[0].category_id}::uuid and p.id != ${id}::uuid and p.is_active = true
      limit 6
    `;
  }

  return NextResponse.json(related);
}
