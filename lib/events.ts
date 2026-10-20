import { EventEmitter } from "events";
import { prisma } from "./prisma";

// Pushes "new order" / "order updated" events to open admin dashboard tabs
// over Server-Sent Events (app/api/orders/stream/route.ts).
//
// Events go through the order_events table rather than straight to an
// in-process emitter, so they reach every admin tab even when the site runs on
// several server instances (the instance that took the order is often not the
// one holding the admin's SSE connection). Each instance runs one shared poller
// while at least one admin tab is connected, and re-emits new rows locally.

const POLL_MS = 2000;

type Bus = { emitter: EventEmitter; timer?: ReturnType<typeof setInterval>; lastId?: bigint; polling: boolean };
const globalForEvents = globalThis as unknown as { orderEventBus?: Bus };
const bus: Bus = globalForEvents.orderEventBus ?? { emitter: new EventEmitter(), polling: false };
bus.emitter.setMaxListeners(50);
globalForEvents.orderEventBus = bus;

type OrderEvent =
  | { type: "new_order"; orderId: string; orderNumber: string }
  | { type: "order_updated"; orderId: string; status: string }
  | { type: "low_stock"; orderId: string; orderNumber: string };

export async function broadcastOrderEvent(event: OrderEvent) {
  try {
    await prisma.$executeRaw`insert into order_events (payload) values (${JSON.stringify(event)}::jsonb)`;
  } catch (err) {
    // A missed live notification must never fail the order itself.
    console.error("[events] broadcast failed", err);
  }
}

async function poll() {
  if (bus.polling) return;
  bus.polling = true;
  try {
    if (bus.lastId === undefined) {
      // Start from "now": tabs only want events that happen while they're open.
      const rows = await prisma.$queryRaw<{ id: bigint }[]>`select coalesce(max(id), 0)::bigint as id from order_events`;
      bus.lastId = rows[0].id;
      return;
    }
    const rows = await prisma.$queryRaw<{ id: bigint; payload: OrderEvent }[]>`
      select id, payload from order_events where id > ${bus.lastId} order by id limit 100
    `;
    for (const row of rows) {
      bus.lastId = row.id;
      bus.emitter.emit("event", row.payload);
    }
    if (Math.random() < 0.02) {
      await prisma.$executeRaw`delete from order_events where created_at < now() - interval '1 hour'`;
    }
  } catch (err) {
    console.error("[events] poll failed", err);
  } finally {
    bus.polling = false;
  }
}

/** Subscribes to order events; returns the unsubscribe function. */
export function subscribeOrderEvents(listener: (event: OrderEvent) => void): () => void {
  bus.emitter.on("event", listener);
  if (!bus.timer) {
    bus.lastId = undefined;
    void poll();
    bus.timer = setInterval(poll, POLL_MS);
  }
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    bus.emitter.off("event", listener);
    if (bus.emitter.listenerCount("event") === 0 && bus.timer) {
      clearInterval(bus.timer);
      bus.timer = undefined;
    }
  };
}
