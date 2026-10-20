import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isOwner } from "@/lib/auth";
import { listCoupons, parseCouponInput } from "@/lib/coupons";
import { logAdminAction } from "@/lib/audit";

export async function GET() {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });
  return NextResponse.json(await listCoupons());
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });

  const parsed = parseCouponInput(await req.json().catch(() => ({})));
  if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });

  const clash = await prisma.$queryRaw<{ id: string }[]>`select id from coupons where code = ${parsed.code}`;
  if (clash[0]) return NextResponse.json({ error: "Diesen Code gibt es bereits." }, { status: 409 });

  await prisma.$executeRaw`
    insert into coupons (code, description, discount_type, discount_value, min_subtotal, max_uses,
                         once_per_customer, starts_at, expires_at, is_active)
    values (${parsed.code}, ${parsed.description}, ${parsed.discountType}, ${parsed.discountValue}, ${parsed.minSubtotal},
            ${parsed.maxUses}, ${parsed.oncePerCustomer}, ${parsed.startsAt}, ${parsed.expiresAt}, ${parsed.isActive})
  `;
  await logAdminAction(session, "coupon.create", "coupon", null, `Gutschein angelegt: ${parsed.code}`);
  return NextResponse.json(await listCoupons(), { status: 201 });
}
