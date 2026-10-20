// lib/coupons.ts — discount codes entered at checkout.
//
// Usage is counted from the orders table itself (orders.coupon_code on
// non-cancelled orders), so there's no separate redemption counter that can
// drift out of sync — cancelling an order automatically frees its use.

import { prisma } from "./prisma";

type CouponType = "PERCENT" | "FIXED" | "FREE_DELIVERY";

type Coupon = {
  id: string;
  code: string;
  description: string | null;
  discountType: CouponType;
  discountValue: number;
  minSubtotal: number;
  maxUses: number | null;
  oncePerCustomer: boolean;
  startsAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  uses: number;
};

type CouponRow = Omit<Coupon, "discountValue" | "minSubtotal" | "uses"> & {
  discountValue: string;
  minSubtotal: string;
  uses: bigint | number;
};

function shape(r: CouponRow): Coupon {
  return { ...r, discountValue: Number(r.discountValue), minSubtotal: Number(r.minSubtotal), uses: Number(r.uses) };
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export async function listCoupons(): Promise<Coupon[]> {
  const rows = await prisma.$queryRaw<CouponRow[]>`
    select c.id, c.code, c.description, c.discount_type as "discountType", c.discount_value as "discountValue",
           c.min_subtotal as "minSubtotal", c.max_uses as "maxUses", c.once_per_customer as "oncePerCustomer",
           c.starts_at as "startsAt", c.expires_at as "expiresAt", c.is_active as "isActive", c.created_at as "createdAt",
           (select count(*) from orders o where o.coupon_code = c.code and o.status <> 'CANCELLED') as uses
    from coupons c
    order by c.created_at desc
  `;
  return rows.map(shape);
}

async function findCoupon(code: string): Promise<Coupon | null> {
  const rows = await prisma.$queryRaw<CouponRow[]>`
    select c.id, c.code, c.description, c.discount_type as "discountType", c.discount_value as "discountValue",
           c.min_subtotal as "minSubtotal", c.max_uses as "maxUses", c.once_per_customer as "oncePerCustomer",
           c.starts_at as "startsAt", c.expires_at as "expiresAt", c.is_active as "isActive", c.created_at as "createdAt",
           (select count(*) from orders o where o.coupon_code = c.code and o.status <> 'CANCELLED') as uses
    from coupons c
    where c.code = ${normalizeCode(code)}
  `;
  return rows[0] ? shape(rows[0]) : null;
}

type CouponResult =
  | { ok: true; coupon: Coupon; discount: number; freeDelivery: boolean }
  | { ok: false; error: string };

/**
 * Checks a code against a cart subtotal (and the customer, for once-per-customer
 * codes) and works out the discount. The discount never exceeds the subtotal.
 */
export async function evaluateCoupon(code: string, subtotal: number, userId: string | null): Promise<CouponResult> {
  const coupon = await findCoupon(code);
  const now = Date.now();
  if (!coupon || !coupon.isActive) return { ok: false, error: "Dieser Gutscheincode ist ungültig." };
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now) return { ok: false, error: "Dieser Gutschein ist noch nicht gültig." };
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < now) return { ok: false, error: "Dieser Gutschein ist abgelaufen." };
  if (coupon.maxUses != null && coupon.uses >= coupon.maxUses) return { ok: false, error: "Dieser Gutschein wurde bereits vollständig eingelöst." };
  if (subtotal < coupon.minSubtotal) {
    return { ok: false, error: `Dieser Gutschein gilt ab einem Bestellwert von €${coupon.minSubtotal.toFixed(2)}.` };
  }
  if (coupon.oncePerCustomer && userId) {
    const used = await prisma.$queryRaw<{ n: bigint }[]>`
      select count(*) as n from orders
      where user_id = ${userId}::uuid and coupon_code = ${coupon.code} and status <> 'CANCELLED'
    `;
    if (Number(used[0]?.n ?? 0) > 0) return { ok: false, error: "Sie haben diesen Gutschein bereits verwendet." };
  }

  let discount = 0;
  if (coupon.discountType === "PERCENT") discount = (subtotal * coupon.discountValue) / 100;
  else if (coupon.discountType === "FIXED") discount = coupon.discountValue;
  discount = Math.min(subtotal, Math.round(discount * 100) / 100);

  return { ok: true, coupon, discount, freeDelivery: coupon.discountType === "FREE_DELIVERY" };
}

type CouponInput = {
  code?: string;
  description?: string;
  discountType?: string;
  discountValue?: number | string;
  minSubtotal?: number | string;
  maxUses?: number | string | null;
  oncePerCustomer?: boolean;
  startsAt?: string | null;
  expiresAt?: string | null;
  isActive?: boolean;
};

/** Validates admin coupon input; returns a normalized object or an error string. */
export function parseCouponInput(body: CouponInput) {
  const code = normalizeCode(body.code ?? "");
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return "Der Code muss 3–32 Zeichen lang sein (Buchstaben, Ziffern, - oder _).";
  const discountType = body.discountType ?? "PERCENT";
  if (!["PERCENT", "FIXED", "FREE_DELIVERY"].includes(discountType)) return "Ungültiger Rabatttyp.";
  const discountValue = discountType === "FREE_DELIVERY" ? 0 : Number(body.discountValue);
  if (!Number.isFinite(discountValue) || discountValue < 0) return "Ungültiger Rabattwert.";
  if (discountType === "PERCENT" && (discountValue <= 0 || discountValue > 100)) return "Prozentrabatt muss zwischen 1 und 100 liegen.";
  if (discountType === "FIXED" && discountValue <= 0) return "Der Rabattbetrag muss größer als 0 sein.";
  const minSubtotal = Number(body.minSubtotal || 0);
  if (!Number.isFinite(minSubtotal) || minSubtotal < 0) return "Ungültiger Mindestbestellwert.";
  const maxUses = body.maxUses === null || body.maxUses === "" || body.maxUses === undefined ? null : Math.floor(Number(body.maxUses));
  if (maxUses !== null && (!Number.isFinite(maxUses) || maxUses < 1)) return "Maximale Einlösungen muss mindestens 1 sein.";
  const startsAt = body.startsAt ? new Date(body.startsAt) : null;
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if ((startsAt && isNaN(startsAt.getTime())) || (expiresAt && isNaN(expiresAt.getTime()))) return "Ungültiges Datum.";
  return {
    code,
    description: body.description?.trim().slice(0, 200) || null,
    discountType,
    discountValue,
    minSubtotal,
    maxUses,
    oncePerCustomer: body.oncePerCustomer ?? true,
    startsAt,
    expiresAt,
    isActive: body.isActive ?? true,
  };
}
