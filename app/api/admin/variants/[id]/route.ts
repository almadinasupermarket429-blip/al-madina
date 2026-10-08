import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isOwner } from "@/lib/auth";

// Owner only: quick inline stock / price edit for one product size, without
// opening (and re-saving) the whole product form.
//   { stock: 12 }          set absolute stock
//   { adjust: +10 | -3 }   add/remove units (e.g. a delivery came in, breakage)
//   { price: 2.49 }        change price
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (body.stock !== undefined) {
    const n = Math.floor(Number(body.stock));
    if (!(n >= 0 && n <= 100_000)) return NextResponse.json({ error: "Ungültiger Bestand." }, { status: 400 });
    await prisma.$executeRaw`update product_variants set stock_quantity = ${n} where id = ${id}::uuid`;
  } else if (body.adjust !== undefined) {
    const n = Math.floor(Number(body.adjust));
    if (!Number.isFinite(n) || Math.abs(n) > 100_000) return NextResponse.json({ error: "Ungültige Änderung." }, { status: 400 });
    await prisma.$executeRaw`update product_variants set stock_quantity = greatest(0, stock_quantity + ${n}) where id = ${id}::uuid`;
  }
  if (body.price !== undefined) {
    const p = Number(body.price);
    if (!(p >= 0 && p <= 10_000)) return NextResponse.json({ error: "Ungültiger Preis." }, { status: 400 });
    await prisma.$executeRaw`update product_variants set price = ${Math.round(p * 100) / 100} where id = ${id}::uuid`;
  }

  const rows = await prisma.$queryRaw<{ id: string; stock: number; price: string }[]>`
    select id, stock_quantity as stock, price from product_variants where id = ${id}::uuid
  `;
  if (!rows[0]) return NextResponse.json({ error: "Größe nicht gefunden." }, { status: 404 });
  return NextResponse.json({ id: rows[0].id, stock: rows[0].stock, price: Number(rows[0].price) });
}
