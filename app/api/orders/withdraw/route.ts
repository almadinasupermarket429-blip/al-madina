// app/api/orders/withdraw/route.ts
// The online withdrawal function ("Vertrag widerrufen", § 356a BGB). Works without an
// account: the order number plus the email used for the order identify the contract.
import { NextRequest, NextResponse, after } from "next/server";
import { appendInternalNote, cancelOrder, getOrderById, getOrderByNumber } from "@/lib/orders";
import { broadcastOrderEvent } from "@/lib/events";
import { sendStoreWithdrawalNotice, sendWithdrawalConfirmationEmail, type WithdrawalOutcome } from "@/lib/mailer";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const { allowed } = await rateLimit(`order-withdraw:${clientIp(req)}`, 10, 15 * 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Zu viele Versuche. Bitte versuchen Sie es später erneut." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const orderNumber = String(body.orderNumber ?? "").trim().toUpperCase();
  const email = String(body.email ?? "").trim().toLowerCase();
  const message = String(body.message ?? "").trim().slice(0, 1000);
  if (!orderNumber || !email) {
    return NextResponse.json({ error: "Bestellnummer und E-Mail sind erforderlich." }, { status: 400 });
  }

  const order = await getOrderByNumber(orderNumber);
  // Same rule as order tracking: an empty email never matches.
  if (!order || !order.customerEmail || order.customerEmail.toLowerCase() !== email) {
    return NextResponse.json({ error: "Keine Bestellung mit dieser Bestellnummer und E-Mail gefunden." }, { status: 404 });
  }
  if (order.status === "CANCELLED") {
    return NextResponse.json({ outcome: "already_cancelled" });
  }

  const receivedAt = new Date();
  const stamp = receivedAt.toLocaleString("de-DE", { timeZone: "Europe/Berlin" });
  let outcome: WithdrawalOutcome;

  // Not out of the door yet: cancel right away and put the items back in stock.
  if ((order.status === "PLACED" || order.status === "PACKED") && (await cancelOrder(order.id, "Widerruf durch Kunden (Online-Formular)"))) {
    outcome = "cancelled";
  } else {
    outcome = "recorded";
  }
  await appendInternalNote(
    order.id,
    `↩️ WIDERRUF erklärt am ${stamp} (Online-Formular)${outcome === "cancelled" ? ", automatisch storniert" : ", bitte Kunden kontaktieren"}${message ? `. Nachricht: ${message}` : ""}`
  );

  const updated = (await getOrderById(order.id)) ?? order;
  await broadcastOrderEvent({ type: "order_updated", orderId: updated.id, status: updated.status });
  after(async () => {
    await sendWithdrawalConfirmationEmail(updated, outcome, receivedAt).catch((e: unknown) => console.error("[mailer] withdrawal confirmation failed", e));
    await sendStoreWithdrawalNotice(updated.orderNumber, outcome).catch((e: unknown) => console.error("[mailer] withdrawal store notice failed", e));
  });

  return NextResponse.json({ outcome, receivedAt: receivedAt.toISOString() });
}
