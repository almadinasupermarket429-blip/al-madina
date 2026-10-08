import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isOwner } from "@/lib/auth";
import { listCategories } from "@/lib/catalog-admin";

// Owner only: rename, reorder, set image, show/hide.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name || name.length > 60) return NextResponse.json({ error: "Ungültiger Name." }, { status: 400 });
    const clash = await prisma.$queryRaw<{ id: string }[]>`
      select id from categories where lower(name) = lower(${name}) and id <> ${id}::uuid
    `;
    if (clash[0]) return NextResponse.json({ error: "Eine Kategorie mit diesem Namen gibt es bereits." }, { status: 409 });
    await prisma.$executeRaw`update categories set name = ${name} where id = ${id}::uuid`;
  }
  if (body.sortOrder !== undefined) {
    const n = Math.floor(Number(body.sortOrder));
    if (!Number.isFinite(n)) return NextResponse.json({ error: "Ungültige Reihenfolge." }, { status: 400 });
    await prisma.$executeRaw`update categories set sort_order = ${n} where id = ${id}::uuid`;
  }
  if (body.imageUrl !== undefined) {
    const url = String(body.imageUrl || "").trim();
    if (url && !/^https?:\/\//.test(url)) return NextResponse.json({ error: "Bild-URL muss mit http(s):// beginnen." }, { status: 400 });
    await prisma.$executeRaw`update categories set image_url = ${url || null} where id = ${id}::uuid`;
  }
  if (typeof body.isActive === "boolean") {
    await prisma.$executeRaw`update categories set is_active = ${body.isActive} where id = ${id}::uuid`;
  }
  return NextResponse.json(await listCategories());
}

// Owner only: delete a category. Its products stay, just uncategorised
// (products.category_id is ON DELETE SET NULL).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });
  const { id } = await params;
  await prisma.$executeRaw`delete from categories where id = ${id}::uuid`;
  return NextResponse.json(await listCategories());
}
