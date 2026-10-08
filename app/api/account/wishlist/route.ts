// app/api/account/wishlist/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customer-auth";

type WishlistProductRow = { id: string; name: string; slug: string; image: string | null; category: string | null };
type VariantRow = {
  productId: string;
  id: string;
  sizeLabel: string;
  price: string;
  stockQuantity: number;
};

// Customer only: list wishlisted products (with variants, so they can add straight to basket).
export async function GET() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const products = await prisma.$queryRaw<WishlistProductRow[]>`
    select p.id, p.name, p.slug, p.image_url as "image", c.name as "category"
    from wishlists w
    join products p on p.id = w.product_id
    left join categories c on c.id = p.category_id
    where w.user_id = ${session.userId}::uuid
    order by w.created_at desc
  `;

  if (products.length === 0) return NextResponse.json([]);

  const productIds = products.map((p) => p.id);
  const variants = await prisma.$queryRaw<VariantRow[]>`
    select product_id as "productId", id, size_label as "sizeLabel", price, stock_quantity as "stockQuantity"
    from product_variants
    where product_id = any(${productIds}::uuid[]) and is_active = true
    order by sort_order asc
  `;

  const byProduct = new Map<string, VariantRow[]>();
  for (const v of variants) {
    const list = byProduct.get(v.productId) ?? [];
    list.push(v);
    byProduct.set(v.productId, list);
  }

  return NextResponse.json(
    products.map((p) => ({
      ...p,
      sizes: (byProduct.get(p.id) ?? []).map((v) => ({ ...v, price: Number(v.price) })),
    }))
  );
}

// Customer only: add a product to the wishlist.
export async function POST(req: NextRequest) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Bitte melden Sie sich an, um Artikel zu speichern." }, { status: 401 });

  const { productId } = await req.json().catch(() => ({}));
  if (!productId) return NextResponse.json({ error: "productId ist erforderlich." }, { status: 400 });

  await prisma.$executeRaw`
    insert into wishlists (user_id, product_id)
    values (${session.userId}::uuid, ${productId}::uuid)
    on conflict do nothing
  `;

  return NextResponse.json({ ok: true });
}