import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isOwner } from "@/lib/auth";
import { getAdminProductView, parseTags, replaceVariants, resolveCategoryId } from "@/lib/catalog-admin";
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

  const existing = await prisma.$queryRaw<{ id: string; slug: string }[]>`
    select id, slug from products where id = ${id}::uuid
  `;
  if (!existing[0]) return NextResponse.json({ error: "Produkt nicht gefunden" }, { status: 404 });

  const categoryId = await resolveCategoryId(category);

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
        updated_at = now()
      where id = ${id}::uuid
    `;

    if (Array.isArray(sizes)) {
      await replaceVariants(tx, id, existing[0].slug || slugify(name), sizes);
    }
  });

  const product = await getAdminProductView(id);
  return NextResponse.json(product);
}

// Admin only: delete a product.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });

  const { id } = await params;
  await prisma.$executeRaw`delete from products where id = ${id}::uuid`.catch(() => null);
  return NextResponse.json({ ok: true });
}
