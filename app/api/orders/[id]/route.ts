// app/api/orders/[id]/route.ts
import { NextRequest, NextResponse, after } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ORDER_STATUSES } from "@/lib/order-utils";
import { broadcastOrderEvent } from "@/lib/events";
import { sendStatusUpdateEmail } from "@/lib/mailer";
import { cancelOrder, getOrderById, setOrderStatus } from "@/lib/orders";

// Admin only: one order (packing slip, detail views).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 });
  return NextResponse.json(order);
}

// Admin only. Body is one of:
//   { status: "PACKED" | "OUT_FOR_DELIVERY" | "DELIVERED" | ... }  — move the order along
//   { status: "CANCELLED", reason?: string }                        — cancel + restock
//   { internalNote: string }                                        — staff-only note
// (Marking DELIVERED is normally done by the delivery person via the /deliver/[token] link,
// but an admin can also do it from the dashboard if needed.)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const existing = await getOrderById(id);
  if (!existing) return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 });

  if (typeof body.internalNote === "string") {
    await prisma.$executeRaw`update orders set internal_note = ${body.internalNote.slice(0, 2000) || null} where id = ${id}::uuid`;
    return NextResponse.json(await getOrderById(id));
  }

  const { status } = body;
  if (status === "CANCELLED") {
    const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 300) : null;
    const ok = await cancelOrder(id, reason);
    if (!ok) {
      return NextResponse.json({ error: "Nur neue oder gepackte Bestellungen können storniert werden." }, { status: 409 });
    }
  } else if (ORDER_STATUSES.includes(status)) {
    if (existing.status === "CANCELLED") {
      return NextResponse.json({ error: "Diese Bestellung wurde storniert." }, { status: 409 });
    }
    await setOrderStatus(id, status);
  } else {
    return NextResponse.json({ error: "Ungültiger Status." }, { status: 400 });
  }

  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 });

  await broadcastOrderEvent({ type: "order_updated", orderId: order.id, status: order.status });

  // See app/api/orders/route.ts for why this is wrapped in after() rather
  // than a bare fire-and-forget .catch() — same Vercel timing issue applies here.
  after(async () => {
    await sendStatusUpdateEmail(order).catch((e: unknown) => console.error("[mailer] status email failed", e));
  });

  return NextResponse.json(order);
}
