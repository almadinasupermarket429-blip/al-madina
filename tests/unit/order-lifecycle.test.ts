import { describe, expect, it } from "vitest";
import { ORDER_TRANSITIONS, canMoveTo, generateOrderNumber, statusesBefore } from "@/lib/order-utils";
import { htmlToText } from "@/lib/mailer";

describe("order status steps", () => {
  it("only moves forward, skipping allowed", () => {
    expect(canMoveTo("PLACED", "PACKED")).toBe(true);
    expect(canMoveTo("PACKED", "DELIVERED")).toBe(true); // pickup
    expect(canMoveTo("PACKED", "PLACED")).toBe(false);
    expect(canMoveTo("DELIVERED", "PACKED")).toBe(false);
  });
  it("delivered and cancelled are final", () => {
    expect(ORDER_TRANSITIONS.DELIVERED).toEqual([]);
    expect(ORDER_TRANSITIONS.CANCELLED).toEqual([]);
    expect(canMoveTo("CANCELLED", "DELIVERED")).toBe(false);
  });
  it("knows which statuses lead to a status", () => {
    expect(statusesBefore("DELIVERED").sort()).toEqual(["OUT_FOR_DELIVERY", "PACKED", "PLACED"]);
    expect(statusesBefore("PLACED")).toEqual([]);
  });
});

describe("generateOrderNumber", () => {
  it("uses the date in Germany, not the server's UTC date", () => {
    // 23:30 UTC on 4 Nov is 00:30 on 5 Nov in Berlin.
    expect(generateOrderNumber(new Date("2026-11-04T23:30:00Z"))).toMatch(/^AM-20261105-[0-9A-F]{6}$/);
    // Summer time: 22:30 UTC on 1 Jul is 00:30 on 2 Jul in Berlin.
    expect(generateOrderNumber(new Date("2026-07-01T22:30:00Z"))).toMatch(/^AM-20260702-/);
  });
});

describe("htmlToText (plain-text part of emails)", () => {
  it("keeps paragraphs and link targets and decodes entities", () => {
    const text = htmlToText('<p>Hallo &amp; willkommen</p><p><a href="https://shop.example/account" style="x">Bestellung ansehen</a></p>');
    expect(text).toBe("Hallo & willkommen\nBestellung ansehen (https://shop.example/account)");
  });
  it("turns table rows into lines", () => {
    expect(htmlToText("<table><tr><td>Reis</td><td>11,99 €</td></tr><tr><td>Tee</td><td>3,99 €</td></tr></table>")).toBe("Reis 11,99 €\nTee 3,99 €");
  });
});
