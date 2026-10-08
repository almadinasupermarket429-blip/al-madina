// app/api/account/orders/route.ts
import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { getOrdersByUserId, publicOrder } from "@/lib/orders";

export async function GET() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const orders = await getOrdersByUserId(session.userId);
  return NextResponse.json(orders.map(publicOrder));
}
