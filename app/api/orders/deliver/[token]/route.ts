// app/api/orders/deliver/[token]/route.ts
import { NextRequest, NextResponse, after } from "next/server";
import { broadcastOrderEvent } from "@/lib/events";
import { sendStatusUpdateEmail } from "@/lib/mailer";
import { getOrderByToken, publicOrder, setOrderStatus } from "@/lib/orders";

// No admin login here on purpose: the delivery person opens a link with a
// long random token in it (printed on the packing slip / sent by SMS/WhatsApp).
// The token is what protects this, the same way a parcel tracking link works.

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getOrderByToken(token);
  if (!order) return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 });
  return NextResponse.json(publicOrder(order));
}

// The delivery person taps "Mark as received" — this is the only action this endpoint allows.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const existing = await getOrderByToken(token);
  if (!existing) return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 });
  if (existing.status === "CANCELLED") {
    return NextResponse.json({ error: "Diese Bestellung wurde storniert." }, { status: 409 });
  }
  if (existing.status === "DELIVERED") return NextResponse.json(publicOrder(existing));

  await setOrderStatus(existing.id, "DELIVERED");
  const order = await getOrderByToken(token);
  if (!order) return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 });

  await broadcastOrderEvent({ type: "order_updated", orderId: order.id, status: order.status });

  // See app/api/orders/route.ts for why this is after() rather than a bare .catch().
  after(async () => {
    await sendStatusUpdateEmail(order).catch((e: unknown) => console.error("[mailer] status email failed", e));
  });

  return NextResponse.json(publicOrder(order));
}
