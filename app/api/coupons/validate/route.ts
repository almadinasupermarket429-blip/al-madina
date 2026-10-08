import { NextRequest, NextResponse } from "next/server";
import { evaluateCoupon } from "@/lib/coupons";
import { getCustomerSession } from "@/lib/customer-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

// Preview a coupon at checkout (logged-in customers only — checkout needs an
// account anyway). The order endpoint re-validates everything server-side, so
// this is purely for showing the discount early. Limited per IP *and* per
// account, so codes can't be guessed by rotating IPs or accounts cheaply.
export async function POST(req: NextRequest) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Bitte melden Sie sich an, um einen Gutschein einzulösen." }, { status: 401 });
  }
  if (
    !(await rateLimit(`coupon-validate:${clientIp(req)}`, 20, 60_000)).allowed ||
    !(await rateLimit(`coupon-validate-user:${session.userId}`, 10, 10 * 60_000)).allowed
  ) {
    return NextResponse.json({ error: "Zu viele Versuche. Bitte warten Sie einen Moment." }, { status: 429 });
  }
  const { code, subtotal } = await req.json().catch(() => ({}));
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Bitte geben Sie einen Gutscheincode ein." }, { status: 400 });
  }
  const result = await evaluateCoupon(code, Math.max(0, Number(subtotal) || 0), session.userId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({
    code: result.coupon.code,
    description: result.coupon.description,
    discount: result.discount,
    freeDelivery: result.freeDelivery,
  });
}
