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

  const order = await getOrderByNumber(orderNumber.trim().toUpperCase());

  if (!order || order.customerEmail.toLowerCase() !== email.trim().toLowerCase()) {
    return NextResponse.json({ error: "Keine Bestellung mit dieser Bestellnummer und E-Mail gefunden." }, { status: 404 });
  }

  return NextResponse.json(publicOrder(order));
}
