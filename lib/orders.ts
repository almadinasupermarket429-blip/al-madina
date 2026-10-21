// lib/orders.ts
//
// Shared "load a full order with its items + status history" logic for the
// new orders/order_items/order_status_history tables. Every order-related
// route (admin, tracking, delivery link, account history) goes through this
// so the object shape handed to the mailer and the frontend is defined once.
//
// Table definitions: db/migrations/000_base_schema.sql (+ 001 for discount,
// coupon, substitution, cancellation and slot columns).

import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

type StatusEvent = { status: string; createdAt: Date };

export type FullOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillment: string;
  address: string | null;
  notes: string | null;
  subtotal: number;
  discount: number;
  couponCode: string | null;
  deliveryFee: number;
  total: number;
  substitution: string;
  cancelReason: string | null;
  internalNote: string | null;
  slot: { date: string; start: string; end: string } | null;
  deliveryToken: string;
  userId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  items: {
    id: string;
    orderId: string;
    productId: string | null;
    sizeId: string | null;
    name: string;
    sizeLabel: string | null;
    price: number;
    qty: number;
  }[];
  statusEvents: StatusEvent[];
};

type OrderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  fulfillment: string;
  address: string | null;
  notes: string | null;
  subtotal: string | number;
  discount: string | number;
  coupon_code: string | null;
  delivery_fee: string | number;
  total: string | number;
  substitution: string;
  cancel_reason: string | null;
  internal_note: string | null;
  slot_date: string | null;
  slot_start: string | null;
  slot_end: string | null;
  delivery_token: string;
  user_id: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
};

type ItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  name: string;
  size_label: string | null;
  price: string | number;
  qty: number;
};

// Shared column list (aliased to OrderRow) — orders is aliased `o`, delivery_slots `s`.
const ORDER_COLUMNS = Prisma.sql`
  o.id, o.order_number, o.customer_name, o.customer_email, o.customer_phone,
  o.fulfillment, o.address, o.notes, o.subtotal, o.discount, o.coupon_code, o.delivery_fee, o.total,
  o.substitution, o.cancel_reason, o.internal_note,
  to_char(s.slot_date, 'YYYY-MM-DD') as slot_date, s.start_time::text as slot_start, s.end_time::text as slot_end,
  o.delivery_token, o.user_id, o.status, o.created_at, o.updated_at
`;

async function assemble(order: OrderRow): Promise<FullOrder> {
  const [items, events] = await Promise.all([
    prisma.$queryRaw<ItemRow[]>`
      select id, order_id, product_id, variant_id, name, size_label, price, qty
      from order_items where order_id = ${order.id}::uuid
    `,
    prisma.$queryRaw<{ status: string; created_at: Date }[]>`
      select status, created_at from order_status_history
      where order_id = ${order.id}::uuid order by created_at asc
    `,
  ]);
  return assembleSync(order, items, events);
}

function assembleSync(order: OrderRow, items: ItemRow[], events: { status: string; created_at: Date }[]): FullOrder {
  return {
    id: order.id,
    orderNumber: order.order_number,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
    fulfillment: order.fulfillment,
    address: order.address,
    notes: order.notes,
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    couponCode: order.coupon_code,
    deliveryFee: Number(order.delivery_fee),
    total: Number(order.total),
    substitution: order.substitution,
    cancelReason: order.cancel_reason,
    internalNote: order.internal_note,
    slot: order.slot_date && order.slot_start && order.slot_end
      ? { date: order.slot_date, start: order.slot_start.slice(0, 5), end: order.slot_end.slice(0, 5) }
      : null,
    deliveryToken: order.delivery_token,
    userId: order.user_id,
    status: order.status,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items: items.map((it) => ({
      id: it.id,
      orderId: it.order_id,
      productId: it.product_id,
      sizeId: it.variant_id,
      name: it.name,
      sizeLabel: it.size_label,
      price: Number(it.price),
      qty: it.qty,
    })),
    statusEvents: events.map((e) => ({ status: e.status, createdAt: e.created_at })),
  };
}

export const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function getOrderById(id: string): Promise<FullOrder | null> {
  if (!isUuid(id)) return null; // malformed ids are "not found", not a Postgres cast error
  const rows = await prisma.$queryRaw<OrderRow[]>`
    select ${ORDER_COLUMNS}
    from orders o left join delivery_slots s on s.id = o.delivery_slot_id
    where o.id = ${id}::uuid
  `;
  return rows[0] ? assemble(rows[0]) : null;
}

export async function getOrderByNumber(orderNumber: string): Promise<FullOrder | null> {
  const rows = await prisma.$queryRaw<OrderRow[]>`
    select ${ORDER_COLUMNS}
    from orders o left join delivery_slots s on s.id = o.delivery_slot_id
    where o.order_number = ${orderNumber}
  `;
  return rows[0] ? assemble(rows[0]) : null;
}

export async function getOrderByToken(token: string): Promise<FullOrder | null> {
  const rows = await prisma.$queryRaw<OrderRow[]>`
    select ${ORDER_COLUMNS}
    from orders o left join delivery_slots s on s.id = o.delivery_slot_id
    where o.delivery_token = ${token}
  `;
  return rows[0] ? assemble(rows[0]) : null;
}

export async function setOrderStatus(id: string, status: string): Promise<void> {
  await prisma.$transaction([
    prisma.$executeRaw`update orders set status = ${status} where id = ${id}::uuid`,
    prisma.$executeRaw`insert into order_status_history (order_id, status) values (${id}::uuid, ${status})`,
  ]);
}

/**
 * Cancels an order and puts its items back into stock, atomically. Only
 * orders that haven't left the store yet (PLACED / PACKED) can be cancelled.
 * Returns false if the order was already past that point (or already cancelled).
 */
export async function cancelOrder(id: string, reason: string | null): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.$executeRaw`
      update orders set status = 'CANCELLED', cancel_reason = ${reason}
      where id = ${id}::uuid and status in ('PLACED', 'PACKED')
    `;
    if (updated === 0) return false;
    await tx.$executeRaw`
      update product_variants pv set stock_quantity = pv.stock_quantity + oi.qty
      from order_items oi
      where oi.order_id = ${id}::uuid and oi.variant_id = pv.id
    `;
    await tx.$executeRaw`insert into order_status_history (order_id, status) values (${id}::uuid, 'CANCELLED')`;
    return true;
  });
}

/** A logged-in customer's own order history, newest first. */
export async function getOrdersByUserId(userId: string): Promise<FullOrder[]> {
  const rows = await prisma.$queryRaw<OrderRow[]>`
    select ${ORDER_COLUMNS}
    from orders o left join delivery_slots s on s.id = o.delivery_slot_id
    where o.user_id = ${userId}::uuid
    order by o.created_at desc
  `;
  return Promise.all(rows.map(assemble));
}

type OrderFilters = {
  status?: string; // a single status, or "ACTIVE" for everything not delivered/cancelled
  q?: string; // matches order number, customer name, email or phone
  from?: string; // YYYY-MM-DD, inclusive
  to?: string; // YYYY-MM-DD, inclusive
  limit?: number;
};

/** Admin order list with filters — loads items + history for all rows in two batched queries. */
export async function listOrders(filters: OrderFilters = {}): Promise<FullOrder[]> {
  const conditions: Prisma.Sql[] = [];
  if (filters.status === "ACTIVE") conditions.push(Prisma.sql`o.status not in ('DELIVERED', 'CANCELLED')`);
  else if (filters.status) conditions.push(Prisma.sql`o.status = ${filters.status}`);
  if (filters.q?.trim()) {
    const like = `%${filters.q.trim().replace(/[%_\\]/g, (c) => "\\" + c)}%`;
    conditions.push(Prisma.sql`(o.order_number ilike ${like} or o.customer_name ilike ${like}
      or o.customer_email ilike ${like} or o.customer_phone ilike ${like})`);
  }
  if (filters.from) conditions.push(Prisma.sql`o.created_at >= (${filters.from}::date at time zone 'Europe/Berlin')`);
  if (filters.to) conditions.push(Prisma.sql`o.created_at < ((${filters.to}::date + 1) at time zone 'Europe/Berlin')`);
  const where = conditions.length ? Prisma.sql`where ${Prisma.join(conditions, " and ")}` : Prisma.empty;
  const limit = Math.min(Math.max(filters.limit ?? 500, 1), 5000);

  const rows = await prisma.$queryRaw<OrderRow[]>`
    select ${ORDER_COLUMNS}
    from orders o left join delivery_slots s on s.id = o.delivery_slot_id
    ${where}
    order by o.created_at desc
    limit ${limit}
  `;
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [items, events] = await Promise.all([
    prisma.$queryRaw<ItemRow[]>`
      select id, order_id, product_id, variant_id, name, size_label, price, qty
      from order_items where order_id = any(${ids}::uuid[])
    `,
    prisma.$queryRaw<{ order_id: string; status: string; created_at: Date }[]>`
      select order_id, status, created_at from order_status_history
      where order_id = any(${ids}::uuid[]) order by created_at asc
    `,
  ]);

  return rows.map((order) => {
    const shaped = assembleSync(order, items.filter((i) => i.order_id === order.id), events.filter((e) => e.order_id === order.id));
    return shaped;
  });
}

/**
 * The order as shown to customers / delivery drivers — without staff-only fields.
 * The delivery token is stripped too: whoever holds it can mark the order
 * delivered, so only staff (packing slip / driver link) may see it.
 */
/** How long the delivery person's link keeps working after an order is finished. */
const DRIVER_LINK_GRACE_MS = 48 * 60 * 60 * 1000;

/**
 * True when a delivery link should no longer show the order: it was delivered or
 * cancelled more than 48 hours ago. Keeps customer details from staying reachable
 * through old links forwarded on WhatsApp/SMS (GDPR data minimisation).
 */
export function isDriverLinkExpired(order: FullOrder): boolean {
  if (order.status !== "DELIVERED" && order.status !== "CANCELLED") return false;
  return Date.now() - new Date(order.updatedAt).getTime() > DRIVER_LINK_GRACE_MS;
}

/** What the delivery person sees: only what's needed to hand over the order (no email, no account id). */
export function driverOrder(order: FullOrder) {
  return {
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    fulfillment: order.fulfillment,
    address: order.address,
    notes: order.notes,
    total: order.total,
    status: order.status,
    slot: order.slot,
    items: order.items.map((i) => ({ id: i.id, name: i.name, sizeLabel: i.sizeLabel, qty: i.qty })),
  };
}

export function publicOrder(order: FullOrder): Omit<FullOrder, "internalNote" | "deliveryToken"> {
  const { internalNote: _note, deliveryToken: _token, ...rest } = order;
  return rest;
}
