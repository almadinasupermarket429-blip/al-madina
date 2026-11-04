// Web Crypto (globalThis.crypto) instead of Node's "crypto" module: the
// status constants below are imported by client components, and importing
// Node's crypto would drag a ~130 kB polyfill into those browser bundles.
function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Human-friendly order number, e.g. AM-20260905-4F2K1A. The date is the shop's (Europe/Berlin):
 * the server runs in UTC, so an order at 00:30 German time would otherwise carry yesterday's date.
 */
export function generateOrderNumber(now: Date = new Date()) {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(now)
    .replaceAll("-", "");
  const suffix = randomHex(3).toUpperCase();
  return `AM-${ymd}-${suffix}`;
}

/** Opaque, unguessable token used in the delivery-person link for one order. */
export function generateDeliveryToken() {
  return randomHex(16);
}

/** The forward progression of an order. CANCELLED is a terminal side-state, not a step. */
export const ORDER_STATUSES = ["PLACED", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

/**
 * Which status an order may move to from each status: forward only, skipping allowed
 * (a pickup goes PACKED -> DELIVERED). DELIVERED and CANCELLED are final.
 * Cancelling is separate (lib/orders.ts cancelOrder: only PLACED / PACKED).
 */
export const ORDER_TRANSITIONS: Record<string, readonly string[]> = {
  PLACED: ["PACKED", "OUT_FOR_DELIVERY", "DELIVERED"],
  PACKED: ["OUT_FOR_DELIVERY", "DELIVERED"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export const canMoveTo = (from: string, to: string) => ORDER_TRANSITIONS[from]?.includes(to) ?? false;

/** The statuses an order can be in for it to move to `to`. */
export const statusesBefore = (to: string) => Object.keys(ORDER_TRANSITIONS).filter((from) => canMoveTo(from, to));

/** What the store should do if an item is unavailable when packing. */
export const SUBSTITUTION_OPTIONS = ["SUBSTITUTE", "CALL", "REMOVE"];
export const SUBSTITUTION_LABELS: Record<string, [string, string]> = {
  SUBSTITUTE: ["Durch ähnlichen Artikel ersetzen", "Replace with a similar item"],
  CALL: ["Mich anrufen", "Call me"],
  REMOVE: ["Artikel weglassen", "Leave it out"],
};

/** A product size at or below this many units left triggers a low-stock alert. */
export const LOW_STOCK_THRESHOLD = 5;
