import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { getCustomerSession } from "@/lib/customer-auth";
import { generateOrderNumber, generateDeliveryToken, LOW_STOCK_THRESHOLD, SUBSTITUTION_OPTIONS } from "@/lib/order-utils";
import { broadcastOrderEvent } from "@/lib/events";
import { sendCustomerConfirmationEmail, sendStoreNotificationEmail, sendLowStockAlert } from "@/lib/mailer";
import { isEmailVerified } from "@/lib/email-verification";
import { isDisposableEmail } from "@/lib/disposable-email";
import { isPlausiblePhoneNumber } from "@/lib/phone";
import { getOrderById, listOrders, publicOrder, type FullOrder } from "@/lib/orders";
import { getStoreSettings, deliveryFeeFor } from "@/lib/settings";
import { evaluateCoupon } from "@/lib/coupons";
import { hasBookableSlots, isSlotBookable } from "@/lib/slots";

type VariantRow = {
  id: string;
  product_id: string;
  size_label: string;
  price: string | number;
  stock_quantity: number;
  product_name: string;
  product_active: boolean;
  variant_active: boolean;
};

function csvCell(value: unknown): string {
  const s = String(value ?? "");
  // Leading =,+,-,@ would be evaluated as a formula by Excel/Sheets — neutralise it.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",;\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function ordersToCsv(orders: FullOrder[]): string {
  const header = [
    "Bestellnummer", "Datum", "Status", "Art", "Kunde", "E-Mail", "Telefon", "Adresse", "Zeitfenster",
    "Artikel", "Zwischensumme", "Rabatt", "Gutschein", "Liefergebühr", "Gesamt",
  ];
  const lines = orders.map((o) =>
    [
      o.orderNumber,
      new Date(o.createdAt).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }),
      o.status,
      o.fulfillment,
      o.customerName,
      o.customerEmail,
      o.customerPhone,
      o.address ?? "",
      o.slot ? `${o.slot.date} ${o.slot.start}-${o.slot.end}` : "",
      o.items.map((it) => `${it.qty}x ${it.name}${it.sizeLabel ? ` (${it.sizeLabel})` : ""}`).join(" | "),
      o.subtotal.toFixed(2),
      o.discount.toFixed(2),
      o.couponCode ?? "",
      o.deliveryFee.toFixed(2),
      o.total.toFixed(2),
    ]
      .map(csvCell)
      .join(";")
  );
  // BOM so Excel opens umlauts correctly; ";" is the German Excel default separator.
  return "﻿" + [header.join(";"), ...lines].join("\r\n");
}

// Admin only: list orders, newest first. Supports ?status=, ?q=, ?from=, ?to=, ?format=csv
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/;
  try {
    const orders = await listOrders({
      status: sp.get("status") || undefined,
      q: sp.get("q") || undefined,
      from: date.test(sp.get("from") ?? "") ? sp.get("from")! : undefined,
      to: date.test(sp.get("to") ?? "") ? sp.get("to")! : undefined,
      limit: sp.get("format") === "csv" ? 5000 : 500,
    });

    if (sp.get("format") === "csv") {
      return new NextResponse(ordersToCsv(orders), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="bestellungen-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }
    return NextResponse.json(orders);
  } catch (err) {
    console.error("[orders GET] failed", err);
    return NextResponse.json({ error: "Bestellungen konnten nicht geladen werden." }, { status: 500 });
  }
}

// Customer only (accounts are mandatory): place a new order. Cash only — no payment is processed here at all.
export async function POST(req: NextRequest) {
  try {
    const customerSession = await getCustomerSession();
    if (!customerSession?.userId) {
      return NextResponse.json({ error: "Bitte melden Sie sich an, um eine Bestellung aufzugeben." }, { status: 401 });
    }
    if (!(await isEmailVerified(customerSession.userId))) {
      return NextResponse.json(
        { error: "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse, bevor Sie eine Bestellung aufgeben.", code: "EMAIL_NOT_VERIFIED" },
        { status: 403 }
      );
    }

    const settings = await getStoreSettings();
    if (!settings.acceptingOrders) {
      return NextResponse.json({ error: settings.closedMessage, code: "STORE_CLOSED" }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const { customerName, customerEmail, customerPhone, fulfillment, address, notes, items, couponCode, slotId, substitution } = body;

    if (!customerName || !customerEmail || !customerPhone) {
      return NextResponse.json({ error: "Name, E-Mail und Telefon sind erforderlich." }, { status: 400 });
    }
    if (String(customerName).length > 120 || String(notes ?? "").length > 1000 || String(address ?? "").length > 300) {
      return NextResponse.json({ error: "Eine der Angaben ist zu lang." }, { status: 400 });
    }
    if (isDisposableEmail(customerEmail)) {
      return NextResponse.json(
        { error: "Bitte verwenden Sie eine dauerhafte E-Mail-Adresse — temporäre Wegwerf-Adressen werden nicht akzeptiert." },
        { status: 400 }
      );
    }
    if (!isPlausiblePhoneNumber(customerPhone)) {
      return NextResponse.json({ error: "Bitte geben Sie eine gültige Telefonnummer ein." }, { status: 400 });
    }
    if (fulfillment !== "DELIVERY" && fulfillment !== "PICKUP") {
      return NextResponse.json({ error: "fulfillment muss DELIVERY oder PICKUP sein." }, { status: 400 });
    }
    if (fulfillment === "DELIVERY" && !settings.deliveryEnabled) {
      return NextResponse.json({ error: "Lieferung ist derzeit nicht verfügbar — bitte wählen Sie Abholung." }, { status: 400 });
    }
    if (fulfillment === "PICKUP" && !settings.pickupEnabled) {
      return NextResponse.json({ error: "Abholung ist derzeit nicht verfügbar — bitte wählen Sie Lieferung." }, { status: 400 });
    }
    if (fulfillment === "DELIVERY" && !address) {
      return NextResponse.json({ error: "Für die Lieferung ist eine Adresse erforderlich." }, { status: 400 });
    }
    const substitutionValue = SUBSTITUTION_OPTIONS.includes(substitution) ? substitution : "CALL";
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Ihr Warenkorb ist leer." }, { status: 400 });
    }

    if (slotId) {
      if (typeof slotId !== "string" || !(await isSlotBookable(slotId))) {
        return NextResponse.json({ error: "Das gewählte Zeitfenster ist nicht mehr verfügbar. Bitte wählen Sie ein anderes." }, { status: 409 });
      }
    } else if (settings.requireSlot && (await hasBookableSlots())) {
      return NextResponse.json({ error: "Bitte wählen Sie ein Zeitfenster." }, { status: 400 });
    }

    const variantIds = items
      .map((it: { sizeId?: string; variantId?: string }) => it.sizeId || it.variantId)
      .filter(Boolean);

    if (variantIds.length === 0) {
      return NextResponse.json({ error: "Ungültige Artikel im Warenkorb." }, { status: 400 });
    }

    const variants = await prisma.$queryRaw<VariantRow[]>`
      select v.id, v.product_id, v.size_label, v.price, v.stock_quantity, v.is_active as variant_active,
             p.name as product_name, p.is_active as product_active
      from product_variants v
      join products p on p.id = v.product_id
      where v.id = ANY(${variantIds}::uuid[])
    `;

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    const orderItemsData: { productId: string; variantId: string; name: string; sizeLabel: string; price: number; qty: number }[] = [];

    for (const it of items) {
      const vId = it.sizeId || it.variantId;
      const variant = variantMap.get(vId);
      if (!variant || !variant.product_active || !variant.variant_active) {
        return NextResponse.json({ error: "Einer der Artikel in Ihrem Warenkorb ist nicht mehr verfügbar." }, { status: 400 });
      }
      // Whole units only: a fractional qty would be charged as-is but stored rounded (1.5 → 2 items).
      const qty = Math.max(1, Math.min(50, Math.floor(Number(it.qty)) || 1));
      if (variant.stock_quantity < qty) {
        return NextResponse.json(
          { error: `Nur noch ${variant.stock_quantity}× "${variant.product_name}" (${variant.size_label}) auf Lager.` },
          { status: 400 }
        );
      }
      orderItemsData.push({
        productId: variant.product_id,
        variantId: variant.id,
        name: variant.product_name,
        sizeLabel: variant.size_label,
        price: Number(variant.price),
        qty,
      });
    }

    const subtotal = Math.round(orderItemsData.reduce((sum, it) => sum + it.price * it.qty, 0) * 100) / 100;
    if (settings.minimumOrder > 0 && subtotal < settings.minimumOrder) {
      return NextResponse.json(
        { error: `Der Mindestbestellwert beträgt €${settings.minimumOrder.toFixed(2)}.`, code: "BELOW_MINIMUM" },
        { status: 400 }
      );
    }

    let discount = 0;
    let appliedCoupon: string | null = null;
    let freeDelivery = false;
    if (couponCode && String(couponCode).trim()) {
      const result = await evaluateCoupon(String(couponCode), subtotal, customerSession.userId);
      if (!result.ok) return NextResponse.json({ error: result.error, code: "COUPON_INVALID" }, { status: 400 });
      discount = result.discount;
      appliedCoupon = result.coupon.code;
      freeDelivery = result.freeDelivery;
    }

    const deliveryFee = freeDelivery ? 0 : deliveryFeeFor(settings, fulfillment, subtotal - discount);
    const total = Math.round((subtotal - discount + deliveryFee) * 100) / 100;

    const orderNumber = generateOrderNumber();
    const deliveryToken = generateDeliveryToken();

    const orderId = await prisma.$transaction(async (tx) => {
      // Re-check slot capacity and coupon limits under a row lock: two customers
      // taking the last place in a slot (or the last use of a coupon) at the same
      // instant are serialized here, and the second one is refused.
      if (slotId) {
        const slot = await tx.$queryRaw<{ capacity: number; is_active: boolean }[]>`
          select capacity, is_active from delivery_slots where id = ${slotId}::uuid for update
        `;
        const booked = await tx.$queryRaw<{ n: number }[]>`
          select count(*)::int as n from orders where delivery_slot_id = ${slotId}::uuid and status <> 'CANCELLED'
        `;
        if (!slot[0]?.is_active || booked[0].n >= slot[0].capacity) throw new Error("SLOT_FULL");
      }
      if (appliedCoupon) {
        const coupon = await tx.$queryRaw<{ max_uses: number | null; once_per_customer: boolean }[]>`
          select max_uses, once_per_customer from coupons where code = ${appliedCoupon} for update
        `;
        const uses = await tx.$queryRaw<{ total: number; mine: number }[]>`
          select count(*)::int as total,
                 count(*) filter (where user_id = ${customerSession.userId}::uuid)::int as mine
          from orders where coupon_code = ${appliedCoupon} and status <> 'CANCELLED'
        `;
        if (!coupon[0]) throw new Error("COUPON_USED_UP");
        if (coupon[0].max_uses !== null && uses[0].total >= coupon[0].max_uses) throw new Error("COUPON_USED_UP");
        if (coupon[0].once_per_customer && uses[0].mine > 0) throw new Error("COUPON_USED_UP");
      }

      // Decrement first, guarded on stock, so two simultaneous checkouts for
      // the last unit can't both succeed (the losing one rolls back here).
      for (const it of orderItemsData) {
        const updated = await tx.$executeRaw`
          update product_variants set stock_quantity = stock_quantity - ${it.qty}
          where id = ${it.variantId}::uuid and stock_quantity >= ${it.qty}
        `;
        if (updated === 0) throw new Error(`OUT_OF_STOCK:${it.name} (${it.sizeLabel})`);
      }

      const orderInsert = await tx.$queryRaw<{ id: string }[]>`
        insert into orders (
          order_number, customer_name, customer_email, customer_phone,
          fulfillment, address, notes, subtotal, discount, coupon_code, delivery_fee, total,
          delivery_token, user_id, status, delivery_slot_id, substitution
        ) values (
          ${orderNumber}, ${customerName}, ${customerEmail}, ${customerPhone},
          ${fulfillment}, ${fulfillment === "DELIVERY" ? address : null}, ${notes || null},
          ${subtotal}, ${discount}, ${appliedCoupon}, ${deliveryFee}, ${total}, ${deliveryToken},
          ${customerSession.userId}::uuid, 'PLACED', ${slotId || null}::uuid, ${substitutionValue}
        )
        returning id
      `;
      const newOrderId = orderInsert[0].id;

      for (const it of orderItemsData) {
        await tx.$executeRaw`
          insert into order_items (order_id, product_id, variant_id, name, size_label, price, qty)
          values (${newOrderId}::uuid, ${it.productId}::uuid, ${it.variantId}::uuid, ${it.name}, ${it.sizeLabel}, ${it.price}, ${it.qty})
        `;
      }

      await tx.$executeRaw`insert into order_status_history (order_id, status) values (${newOrderId}::uuid, 'PLACED')`;
      return newOrderId;
    });

    const fullOrder = await getOrderById(orderId);
    if (!fullOrder) throw new Error("Order vanished right after insert");

    await broadcastOrderEvent({ type: "new_order", orderId: fullOrder.id, orderNumber: fullOrder.orderNumber });

    // Everything below is fire-and-forget (emails, low-stock check) and must
    // not delay the response to the customer. On Vercel, an un-awaited
    // promise can get cut off the instant the response is sent — after()
    // (Next.js 15+) schedules this to run once the response goes out, but
    // keeps the function alive until it actually finishes, so the emails
    // reliably send instead of silently vanishing.
    const variantIdsToCheck = orderItemsData.map((it) => it.variantId);

    after(async () => {
      await Promise.all([
        sendCustomerConfirmationEmail(fullOrder).catch((e: unknown) => console.error("[mailer] customer email failed", e)),
        sendStoreNotificationEmail(fullOrder).catch((e: unknown) => console.error("[mailer] store email failed", e)),
      ]);

      const updatedVariants = await prisma.$queryRaw<{ id: string; stock: number; label: string; product_name: string }[]>`
        select v.id, v.stock_quantity as stock, v.size_label as label, p.name as product_name
        from product_variants v
        join products p on p.id = v.product_id
        where v.id = ANY(${variantIdsToCheck}::uuid[]) and v.stock_quantity <= ${LOW_STOCK_THRESHOLD}
      `;

      if (updatedVariants.length > 0) {
        await broadcastOrderEvent({ type: "low_stock", orderId: fullOrder.id, orderNumber: fullOrder.orderNumber });
        await sendLowStockAlert(
          updatedVariants.map((s) => ({ productName: s.product_name, sizeLabel: s.label, stock: s.stock }))
        ).catch((e: unknown) => console.error("[mailer] low stock email failed", e));
      }
    });

    // publicOrder: the customer must not receive the driver's delivery token.
    return NextResponse.json(publicOrder(fullOrder), { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "SLOT_FULL") {
      return NextResponse.json(
        { error: "Das gewählte Zeitfenster ist gerade voll geworden. Bitte wählen Sie ein anderes." },
        { status: 409 }
      );
    }
    if (err instanceof Error && err.message === "COUPON_USED_UP") {
      return NextResponse.json(
        { error: "Dieser Gutschein wurde gerade vollständig eingelöst.", code: "COUPON_INVALID" },
        { status: 409 }
      );
    }
    if (err instanceof Error && err.message.startsWith("OUT_OF_STOCK:")) {
      return NextResponse.json(
        { error: `"${err.message.slice("OUT_OF_STOCK:".length)}" ist gerade ausverkauft. Bitte passen Sie Ihren Warenkorb an.` },
        { status: 409 }
      );
    }
    console.error("[orders POST] failed", err);
    return NextResponse.json({ error: "Bestellung konnte nicht aufgegeben werden." }, { status: 500 });
  }
}
