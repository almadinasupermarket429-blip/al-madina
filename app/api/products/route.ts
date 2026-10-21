// app/api/products/route.ts
//
// Both GET (storefront listing) and POST (admin "add product") read/write
// the new schema (products/product_variants/categories) — the IDs the
// storefront hands to checkout are real product_variants.id uuids that
// /api/orders can look up directly.

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isOwner } from "@/lib/auth";
import { getAdminProductView, parseProductContent, parseTags, replaceVariants, resolveCategoryId, uniqueProductSlug } from "@/lib/catalog-admin";
import { logAdminAction } from "@/lib/audit";

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  image: string | null;
  nameEn: string | null;
  categoryEn: string | null;
  descriptionEn: string | null;
  brand: string | null;
  highlights: string[];
  highlightsEn: string[];
  specs: unknown;
  gallery: string[];
  badge: string | null;
  unitNote: string | null;
  tags: string[];
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  sizes: {
    id: string;
    productId: string;
    label: string;
    price: number;
    oldPrice: number | null;
    stock: number;
    sortOrder: number;
  }[];
  ratingAverage: string | number;
  ratingCount: string | number;
};

// Public: list products. The admin products page also gets hidden products; the
// storefront asks for ?view=shop so an admin browsing the shop sees what customers see.
export async function GET(req: NextRequest) {
  const shopView = req.nextUrl.searchParams.get("view") === "shop";
  const session = shopView ? null : await getAdminSession();
  // Shoppers don't see hidden products, or products in a hidden category.
  const whereClause = session ? Prisma.empty : Prisma.sql`where p.is_active = true and coalesce(c.is_active, true)`;

  const rows = await prisma.$queryRaw<ProductRow[]>(Prisma.sql`
    with variant_agg as (
      select
        product_id,
        json_agg(
          json_build_object(
            'id', id, 'productId', product_id, 'label', size_label,
            'price', price, 'oldPrice', compare_at_price,
            'stock', stock_quantity, 'sortOrder', sort_order
          ) order by sort_order asc
        ) as sizes
      from product_variants
      where is_active = true
      group by product_id
    ),
    review_agg as (
      select product_id, avg(rating) as rating_average, count(*) as rating_count
      from reviews
      group by product_id
    )
    select
      p.id, p.name, c.name as category, p.description, p.image_url as image,
      p.name_en as "nameEn", c.name_en as "categoryEn", p.description_en as "descriptionEn",
      p.brand, p.highlights, p.highlights_en as "highlightsEn", p.specs, p.gallery,
      p.badge, p.unit_note as "unitNote", p.tags, p.is_active as active, p.sort_order as "sortOrder",
      p.slug, coalesce(c.sort_order, 9999) as "categorySortOrder",
      p.created_at as "createdAt", p.updated_at as "updatedAt",
      coalesce(va.sizes, '[]'::json) as sizes,
      coalesce(ra.rating_average, 0) as "ratingAverage",
      coalesce(ra.rating_count, 0) as "ratingCount"
    from products p
    left join categories c on c.id = p.category_id
    left join variant_agg va on va.product_id = p.id
    left join review_agg ra on ra.product_id = p.id
    ${whereClause}
    order by coalesce(c.sort_order, 9999) asc, p.sort_order asc, p.created_at desc
  `);

  const products = rows.map((p) => ({
    ...p,
    ratingAverage: Math.round(Number(p.ratingAverage) * 10) / 10,
    ratingCount: Number(p.ratingCount),
  }));

  return NextResponse.json(products);
}

// Admin only: create a product with its sizes.
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });

  const body = await req.json();
  const { name, category, description, image, badge, unitNote, active, sizes, tags } = body;

  if (!name || !category || !image || !Array.isArray(sizes) || sizes.length === 0) {
    return NextResponse.json(
      { error: "Name, Kategorie, Bild und mindestens eine Größe sind erforderlich." },
      { status: 400 }
    );
  }

  const slug = await uniqueProductSlug(name);
  const categoryId = await resolveCategoryId(category);
  const c = parseProductContent(body);

  const productId = await prisma.$transaction(async (tx) => {
    const created = await tx.$queryRaw<{ id: string }[]>`
      insert into products (category_id, name, slug, description, image_url, badge, unit_note, is_active, tags,
                            name_en, description_en, brand, highlights, highlights_en, specs, gallery)
      values (${categoryId}::uuid, ${name.trim()}, ${slug}, ${description || null}, ${image}, ${badge || null}, ${unitNote || null}, ${active ?? true}, ${parseTags(tags)}::text[],
              ${c.nameEn}, ${c.descriptionEn}, ${c.brand}, ${c.highlights}::text[], ${c.highlightsEn}::text[], ${JSON.stringify(c.specs)}::jsonb, ${c.gallery}::text[])
      returning id
    `;
    const id = created[0].id;
    await replaceVariants(tx, id, slug, sizes);
    return id;
  });

  const product = await getAdminProductView(productId);
  await logAdminAction(session, "product.create", "product", productId, `Produkt angelegt: ${name.trim()}`);
  return NextResponse.json(product, { status: 201 });
}
