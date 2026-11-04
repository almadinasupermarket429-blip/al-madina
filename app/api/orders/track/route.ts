// app/api/orders/track/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getOrderByNumber, publicOrder } from "@/lib/orders";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const { allowed } = await rateLimit(`order-track:${ip}`, 15, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Zu viele Versuche. Bitte versuchen Sie es in einer Minute erneut." }, { status: 429 });
  }

  const { orderNumber, email } = await req.json().catch(() => ({}));
  if (!orderNumber || !email) {
    return NextResponse.json({ error: "Bestellnummer und E-Mail sind erforderlich." }, { status: 400 });
  }

  const number = String(orderNumber).trim().toUpperCase().slice(0, 40);
  // Per order number too, so many machines together can't keep guessing the email for one order.
  if (!(await rateLimit(`order-track-number:${number}`, 10, 60 * 60_000)).allowed) {
    return NextResponse.json({ error: "Zu viele Versuche für diese Bestellnummer. Bitte später erneut versuchen." }, { status: 429 });
  }
  const order = await getOrderByNumber(number);
  const givenEmail = String(email).trim().toLowerCase();

  // An empty email never matches, so orders whose contact details were removed can't be looked up.
  if (!order || !givenEmail || !order.customerEmail || order.customerEmail.toLowerCase() !== givenEmail) {
    return NextResponse.json({ error: "Keine Bestellung mit dieser Bestellnummer und E-Mail gefunden." }, { status: 404 });
  }

  return NextResponse.json(publicOrder(order));
}
