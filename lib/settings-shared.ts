// Client-safe half of lib/settings.ts (no Prisma import) — the storefront uses these too.

export type StoreSettings = {
  /** Master switch — when false, checkout is refused with closedMessage. */
  acceptingOrders: boolean;
  closedMessage: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  deliveryFee: number;
  /** Subtotal (after discount) at or above which delivery is free. 0 = never free. */
  freeDeliveryThreshold: number;
  /** Minimum subtotal to check out at all. 0 = no minimum. */
  minimumOrder: number;
  /** Optional banner shown above the storefront header. Empty = default banner. */
  announcement: string;
  /** Free-text delivery area note shown at checkout, e.g. "Schweinfurt & 10 km". */
  deliveryArea: string;
  /** When true, customers must pick a delivery/pickup time slot (if any exist). */
  requireSlot: boolean;
};

export const DEFAULT_SETTINGS: StoreSettings = {
  acceptingOrders: true,
  closedMessage: "Wir nehmen gerade keine Online-Bestellungen an. Bitte versuchen Sie es später erneut.",
  deliveryEnabled: true,
  pickupEnabled: true,
  deliveryFee: 3.99,
  freeDeliveryThreshold: 40,
  minimumOrder: 0,
  announcement: "",
  deliveryArea: "Schweinfurt und Umgebung",
  requireSlot: false,
};

/** Delivery fee for a given (post-discount) subtotal under the current settings. */
export function deliveryFeeFor(settings: StoreSettings, fulfillment: "DELIVERY" | "PICKUP", subtotal: number): number {
  if (fulfillment === "PICKUP") return 0;
  if (settings.freeDeliveryThreshold > 0 && subtotal >= settings.freeDeliveryThreshold) return 0;
  return settings.deliveryFee;
}
