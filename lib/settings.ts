// lib/settings.ts
//
// Owner-editable operational settings, stored as key/value rows in
// store_settings (value is jsonb). Every key has a default here, so the
// store works out of the box with an empty table — the admin Settings page
// only writes rows for values the owner actually changes.

import { prisma } from "./prisma";
import { DEFAULT_SETTINGS, type StoreSettings } from "./settings-shared";

export { deliveryFeeFor } from "./settings-shared";

// store_settings keys. cart_minimum_amount predates this file, so it keeps its name.
const KEY_MAP: Record<keyof StoreSettings, string> = {
  acceptingOrders: "accepting_orders",
  closedMessage: "closed_message",
  deliveryEnabled: "delivery_enabled",
  pickupEnabled: "pickup_enabled",
  deliveryFee: "delivery_fee",
  freeDeliveryThreshold: "free_delivery_threshold",
  minimumOrder: "cart_minimum_amount",
  announcement: "announcement",
  deliveryArea: "delivery_area",
  requireSlot: "require_slot",
};

export async function getStoreSettings(): Promise<StoreSettings> {
  const rows = await prisma.$queryRaw<{ key: string; value: unknown }[]>`select key, value from store_settings`;
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const result = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  for (const [field, key] of Object.entries(KEY_MAP)) {
    if (!byKey.has(key)) continue;
    const raw = byKey.get(key);
    const def = DEFAULT_SETTINGS[field as keyof StoreSettings];
    if (typeof def === "number" && Number.isFinite(Number(raw))) result[field] = Number(raw);
    else if (typeof def === "boolean" && typeof raw === "boolean") result[field] = raw;
    else if (typeof def === "string" && typeof raw === "string") result[field] = raw;
  }
  return result as StoreSettings;
}

/** Validates + writes a partial settings update. Returns an error message, or null on success. */
export async function updateStoreSettings(patch: Partial<Record<keyof StoreSettings, unknown>>): Promise<string | null> {
  const writes: [string, unknown][] = [];
  for (const [field, value] of Object.entries(patch)) {
    if (!(field in KEY_MAP)) continue;
    const def = DEFAULT_SETTINGS[field as keyof StoreSettings];
    if (typeof def === "number") {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0 || n > 10_000) return `Ungültiger Wert für ${field}.`;
      writes.push([KEY_MAP[field as keyof StoreSettings], Math.round(n * 100) / 100]);
    } else if (typeof def === "boolean") {
      if (typeof value !== "boolean") return `Ungültiger Wert für ${field}.`;
      writes.push([KEY_MAP[field as keyof StoreSettings], value]);
    } else {
      if (typeof value !== "string" || value.length > 500) return `Ungültiger Wert für ${field}.`;
      writes.push([KEY_MAP[field as keyof StoreSettings], value.trim()]);
    }
  }
  for (const [key, value] of writes) {
    await prisma.$executeRaw`
      insert into store_settings (key, value) values (${key}, ${JSON.stringify(value)}::jsonb)
      on conflict (key) do update set value = excluded.value
    `;
  }
  return null;
}
