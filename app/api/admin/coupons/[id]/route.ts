import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isOwner } from "@/lib/auth";
import { listCoupons, parseCouponInput } from "@/lib/coupons";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });
  const { id } = await params;

  const parsed = parseCouponInput(await req.json().catch(() => ({})));
  if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });

  const clash = await prisma.$queryRaw<{ id: string }[]>`select id from coupons where code = ${parsed.code} and id <> ${id}::uuid`;
  if (clash[0]) return NextResponse.json({ error: "Diesen Code gibt es bereits." }, { status: 409 });

  const updated = await prisma.$executeRaw`
    update coupons set code = ${parsed.code}, description = ${parsed.description}, discount_type = ${parsed.discountType},
      discount_value = ${parsed.discountValue}, min_subtotal = ${parsed.minSubtotal}, max_uses = ${parsed.maxUses},
      once_per_customer = ${parsed.oncePerCustomer}, starts_at = ${parsed.startsAt}, expires_at = ${parsed.expiresAt},
      is_active = ${parsed.isActive}
    where id = ${id}::uuid
  `;
  if (!updated) return NextResponse.json({ error: "Gutschein nicht gefunden." }, { status: 404 });
  return NextResponse.json(await listCoupons());
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });
  const { id } = await params;
  // Past orders keep their own coupon_code snapshot, so deleting is safe.
  await prisma.$executeRaw`delete from coupons where id = ${id}::uuid`;
  return NextResponse.json(await listCoupons());
}
