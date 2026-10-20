// Web Crypto (globalThis.crypto) instead of Node's "crypto" module: the
// status constants below are imported by client components, and importing
// Node's crypto would drag a ~130 kB polyfill into those browser bundles.
function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Human-friendly order number, e.g. AM-20260905-4F2K */
export function generateOrderNumber() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const suffix = randomHex(3).toUpperCase();
  return `AM-${y}${m}${d}-${suffix}`;
}

/** Opaque, unguessable token used in the delivery-person link for one order. */
export function generateDeliveryToken() {
  return randomHex(16);
}

/** The forward progression of an order. CANCELLED is a terminal side-state, not a step. */
export const ORDER_STATUSES = ["PLACED", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

/** What the store should do if an item is unavailable when packing. */
export const SUBSTITUTION_OPTIONS = ["SUBSTITUTE", "CALL", "REMOVE"];
export const SUBSTITUTION_LABELS: Record<string, [string, string]> = {
  SUBSTITUTE: ["Durch ähnlichen Artikel ersetzen", "Replace with a similar item"],
  CALL: ["Mich anrufen", "Call me"],
  REMOVE: ["Artikel weglassen", "Leave it out"],
};

/** A product size at or below this many units left triggers a low-stock alert. */
export const LOW_STOCK_THRESHOLD = 5;
