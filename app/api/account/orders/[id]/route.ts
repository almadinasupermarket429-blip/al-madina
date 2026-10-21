// app/api/account/orders/[id]/route.ts
import { NextResponse, after } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { cancelOrder, getOrderById, publicOrder } from "@/lib/orders";
import { broadcastOrderEvent } from "@/lib/events";
import { sendStatusUpdateEmail } from "@/lib/mailer";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const { id } = await params;
  const order = await getOrderById(id);

  if (!order || order.userId !== session.userId) {
    return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 });
  }

  // internal_note is for staff eyes only.
  return NextResponse.json(publicOrder(order));
}

// The customer cancels their own order — any time before it leaves the store
// (PLACED or PACKED). Once it's out for delivery, they use the withdrawal form instead.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const { id } = await params;
  const order = await getOrderById(id);
  if (!order || order.userId !== session.userId) {
    return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 });
  }
  if (!["PLACED", "PACKED"].includes(order.status) || !(await cancelOrder(id, "Vom Kunden storniert"))) {
    return NextResponse.json(
      { error: "Diese Bestellung ist bereits unterwegs und kann nicht mehr storniert werden. Sie können aber den Vertrag widerrufen (Link unten auf der Seite)." },
      { status: 409 }
    );
  }

  const updated = await getOrderById(id);
  if (updated) {
    await broadcastOrderEvent({ type: "order_updated", orderId: updated.id, status: updated.status });
    after(async () => {
      await sendStatusUpdateEmail(updated).catch((e: unknown) => console.error("[mailer] status email failed", e));
    });
  }
  return NextResponse.json(updated ? publicOrder(updated) : null);
}
