import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isOwner } from "@/lib/auth";
import { getAdminProductView, parseProductContent, parseTags, replaceVariants, resolveCategoryId } from "@/lib/catalog-admin";
import { logAdminAction } from "@/lib/audit";
import { slugify } from "@/lib/slug";

// Admin only: update a product and fully replace its size list
// (simplest, most predictable way to keep sizes in sync with the admin form).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { name, category, description, image, badge, unitNote, active, sizes, tags } = body;

  if (!name || !category || !image) {
    return NextResponse.json({ error: "Name, Kategorie und Bild sind erforderlich." }, { status: 400 });
  }

  const existing = await prisma.$queryRaw<{ id: string; slug: string; name: string }[]>`
    select id, slug, name from products where id = ${id}::uuid
  `;
  if (!existing[0]) return NextResponse.json({ error: "Produkt nicht gefunden" }, { status: 404 });

  const categoryId = await resolveCategoryId(category);
  const c = parseProductContent(body);
  const before = await getAdminProductView(id);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      update products set
        category_id = ${categoryId}::uuid,
        name = ${name},
        description = ${description || null},
        image_url = ${image},
        badge = ${badge || null},
        unit_note = ${unitNote || null},
        is_active = ${active ?? true},
        tags = ${parseTags(tags)}::text[],
        name_en = ${c.nameEn}, description_en = ${c.descriptionEn}, brand = ${c.brand},
        highlights = ${c.highlights}::text[], highlights_en = ${c.highlightsEn}::text[],
        specs = ${JSON.stringify(c.specs)}::jsonb, gallery = ${c.gallery}::text[],
        ingredients = ${c.ingredients}, ingredients_en = ${c.ingredientsEn}, ingredients_not_required = ${c.ingredientsNotRequired},
        allergens = ${c.allergens}::text[], allergens_confirmed = ${c.allergensConfirmed}, traces = ${c.traces},
        nutrition = ${c.nutrition ? JSON.stringify(c.nutrition) : null}::jsonb, nutrition_not_required = ${c.nutritionNotRequired},
        storage = ${c.storage}, storage_en = ${c.storageEn}, manufacturer = ${c.manufacturer}, origin = ${c.origin},
        updated_at = now()
      where id = ${id}::uuid
    `;

    if (Array.isArray(sizes)) {
      await replaceVariants(tx, id, existing[0].slug || slugify(name), sizes);
    }
  });

  const product = await getAdminProductView(id);
  await logAdminAction(session, "product.update", "product", id, `Produkt bearbeitet: ${name}`, {
    priceBefore: before?.sizes.map((s) => ({ label: s.label, price: s.price, stock: s.stock })),
    priceAfter: product?.sizes.map((s) => ({ label: s.label, price: s.price, stock: s.stock })),
    activeBefore: before?.active,
    activeAfter: product?.active,
  });
  return NextResponse.json(product);
}

// Admin only: delete a product.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });

  const { id } = await params;
  const rows = await prisma.$queryRaw<{ name: string }[]>`select name from products where id = ${id}::uuid`;
  const deleted = await prisma.$executeRaw`delete from products where id = ${id}::uuid`.catch(() => null);
  if (deleted === null) {
    // Products that appear in past orders can't be removed (order history keeps them) — hide instead.
    await prisma.$executeRaw`update products set is_active = false where id = ${id}::uuid`;
    await logAdminAction(session, "product.hide", "product", id, `Produkt ausgeblendet (in Bestellungen verwendet): ${rows[0]?.name ?? id}`);
    return NextResponse.json({ ok: true, hidden: true });
  }
  if (rows[0]) await logAdminAction(session, "product.delete", "product", id, `Produkt gelöscht: ${rows[0].name}`);
  return NextResponse.json({ ok: true });
}
