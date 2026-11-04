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
  const name = String(body.name ?? "").trim().slice(0, 120);
  // The form says: name the items, otherwise the whole order. Naming items is a partial withdrawal:
  // the rest of the order still stands, so it must not be cancelled automatically.
  const partial = body.scope === "part" || (body.scope !== "all" && message.length > 0);
  if (!orderNumber || !email) {
    return NextResponse.json({ error: "Bestellnummer und E-Mail sind erforderlich." }, { status: 400 });
  }

  if (!(await rateLimit(`order-withdraw-number:${orderNumber.slice(0, 40)}`, 10, 60 * 60_000)).allowed) {
    return NextResponse.json({ error: "Zu viele Versuche für diese Bestellnummer. Bitte später erneut versuchen." }, { status: 429 });
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
  if (!partial && (order.status === "PLACED" || order.status === "PACKED") && (await cancelOrder(order.id, "Widerruf durch Kunden (Online-Formular)"))) {
    outcome = "cancelled";
  } else {
    outcome = "recorded";
  }
  await appendInternalNote(
    order.id,
    `WIDERRUF ${partial ? "(einzelne Artikel) " : ""}erklärt am ${stamp} (Online-Formular)${name ? ` von ${name}` : ""}${
      outcome === "cancelled" ? ", automatisch storniert" : ", bitte Kunden kontaktieren"
    }${message ? `. Angaben: ${message}` : ""}`
  );

  const updated = (await getOrderById(order.id)) ?? order;
  await broadcastOrderEvent({ type: "order_updated", orderId: updated.id, status: updated.status });
  after(async () => {
    await sendWithdrawalConfirmationEmail(updated, outcome, receivedAt, { partial, message }).catch((e: unknown) => console.error("[mailer] withdrawal confirmation failed", e));
    await sendStoreWithdrawalNotice(updated.orderNumber, outcome, partial).catch((e: unknown) => console.error("[mailer] withdrawal store notice failed", e));
  });

  return NextResponse.json({ outcome, partial, receivedAt: receivedAt.toISOString() });
}
