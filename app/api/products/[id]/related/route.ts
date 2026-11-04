import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isUuid } from "@/lib/orders";

type RelatedProduct = { id: string; name: string; nameEn: string | null; image: string | null; category: string | null };

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

  // Products most often in the same orders as this one, in one query.
  let related = await prisma.$queryRaw<RelatedProduct[]>`
    with together as (
      select oi.product_id, count(*) as n
      from order_items oi
      where oi.order_id in (select order_id from order_items where product_id = ${id}::uuid)
        and oi.product_id is not null and oi.product_id <> ${id}::uuid
      group by oi.product_id
    )
    select p.id, p.name, p.name_en as "nameEn", p.image_url as image, c.name as category
    from together t
    join products p on p.id = t.product_id and p.is_active = true
    left join categories c on c.id = p.category_id
    order by t.n desc, p.name
    limit 6
  `;

  if (related.length === 0) {
    related = await prisma.$queryRaw<RelatedProduct[]>`
      select p.id, p.name, p.name_en as "nameEn", p.image_url as image, c.name as category
      from products p
      left join categories c on c.id = p.category_id
      where p.category_id is not distinct from ${product[0].category_id}::uuid and p.id != ${id}::uuid and p.is_active = true
      limit 6
    `;
  }

  return NextResponse.json(related);
}
