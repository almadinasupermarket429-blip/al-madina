import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, deliveryFeeFor } from "@/lib/settings-shared";
import { storeOpenState } from "@/lib/store-info";
import { generateDeliveryToken, generateOrderNumber } from "@/lib/order-utils";
import { slugify } from "@/lib/slug";
import { isPlausiblePhoneNumber } from "@/lib/phone";

describe("deliveryFeeFor", () => {
  const s = { ...DEFAULT_SETTINGS, deliveryFee: 3.99, freeDeliveryThreshold: 40 };
  it("pickup is always free", () => expect(deliveryFeeFor(s, "PICKUP", 5)).toBe(0));
  it("charges the fee below the threshold", () => expect(deliveryFeeFor(s, "DELIVERY", 39.99)).toBe(3.99));
  it("is free from the threshold on", () => expect(deliveryFeeFor(s, "DELIVERY", 40)).toBe(0));
  it("always charges when there is no free-delivery threshold", () => expect(deliveryFeeFor({ ...s, freeDeliveryThreshold: 0 }, "DELIVERY", 500)).toBe(3.99));
});

describe("storeOpenState (Europe/Berlin, Mon–Sat 07:00–20:00)", () => {
  // Dates are given in UTC; Berlin is UTC+2 in summer time.
  it("is open on a weekday afternoon", () => {
    expect(storeOpenState(new Date("2026-07-15T12:00:00Z"))).toEqual({ open: true, closesAt: "20:00", nextOpen: null });
  });
  it("opens later the same morning before 07:00", () => {
    expect(storeOpenState(new Date("2026-07-15T03:30:00Z"))).toEqual({ open: false, closesAt: null, nextOpen: "07:00" });
  });
  it("is closed at exactly 20:00 and points to the next day", () => {
    expect(storeOpenState(new Date("2026-07-15T18:00:00Z"))).toEqual({ open: false, closesAt: null, nextOpen: "Do 07:00" });
  });
  it("is closed on Sunday and opens Monday", () => {
    expect(storeOpenState(new Date("2026-07-19T10:00:00Z"))).toEqual({ open: false, closesAt: null, nextOpen: "Mo 07:00" });
  });
});

describe("order identifiers", () => {
  it("order numbers look like AM-YYYYMMDD-XXXXXX", () => expect(generateOrderNumber()).toMatch(/^AM-\d{8}-[0-9A-F]{6}$/));
  it("delivery tokens are 32 random hex characters and unique", () => {
    const a = generateDeliveryToken();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(generateDeliveryToken()).not.toBe(a);
  });
});

describe("slugify", () => {
  it.each([
    ["Café Najjar Selection", "cafe-najjar-selection"],
    ["  --Hello World!!  ", "hello-world"],
    ["???", "item"],
  ])("%s → %s", (input, expected) => expect(slugify(input)).toBe(expected));
});

describe("isPlausiblePhoneNumber", () => {
  it.each(["0163 8707437", "+49 163 8707437", "+44 20 7946 0958"])("accepts %s", (n) => expect(isPlausiblePhoneNumber(n)).toBe(true));
  it.each(["", "123", "0000000000", "+49 1"])("rejects %s", (n) => expect(isPlausiblePhoneNumber(n)).toBe(false));
});
