import { describe, expect, it } from "vitest";
import { easterSunday, isPublicHoliday, storeOpenState } from "@/lib/store-info";
import { isSlotOpenForBooking, slotGenerationDates } from "@/lib/slots";

// Instant for a Berlin wall-clock time (CET = UTC+1 in winter, CEST = UTC+2 in summer).
const berlin = (iso: string, offset: string) => new Date(`${iso}${offset}`);

describe("public holidays (Schweinfurt, Bavaria)", () => {
  it("computes Easter", () => {
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
  });

  it("knows fixed and Easter-based holidays", () => {
    expect(isPublicHoliday("2027-03-26")).toBe(true); // Good Friday
    expect(isPublicHoliday("2026-12-25")).toBe(true);
    expect(isPublicHoliday("2026-06-04")).toBe(true); // Corpus Christi
    expect(isPublicHoliday("2026-08-15")).toBe(false); // not in Schweinfurt
    expect(isPublicHoliday("2026-11-04")).toBe(false);
  });
});

describe("storeOpenState", () => {
  it("is closed on a weekday holiday at noon and names the holiday", () => {
    const s = storeOpenState(berlin("2026-12-25T12:00:00", "+01:00")); // Friday
    expect(s.open).toBe(false);
    expect(s.holiday?.de).toBe("1. Weihnachtsfeiertag");
    expect(s.nextOpenAt?.date).toBe("2026-12-28"); // 26th is a holiday, 27th Sunday
  });

  it("is open on a normal Saturday afternoon", () => {
    expect(storeOpenState(berlin("2026-11-07T15:00:00", "+01:00")).open).toBe(true);
  });

  it("uses Berlin time across the DST change", () => {
    // Saturday 2026-03-28 19:30 CET is open; the clocks go forward that night.
    expect(storeOpenState(berlin("2026-03-28T19:30:00", "+01:00")).open).toBe(true);
    // Monday 2026-03-30 06:30 CEST is still closed (opens 07:00).
    expect(storeOpenState(berlin("2026-03-30T06:30:00", "+02:00")).open).toBe(false);
    expect(storeOpenState(berlin("2026-03-30T07:05:00", "+02:00")).open).toBe(true);
  });
});

describe("slots", () => {
  const slot = { date: "2026-11-05", start: "13:00", capacity: 5, booked: 0, isActive: true };

  it("stops offering a slot less than an hour before it starts", () => {
    expect(isSlotOpenForBooking(slot, berlin("2026-11-05T11:59:00", "+01:00"))).toBe(true);
    expect(isSlotOpenForBooking(slot, berlin("2026-11-05T12:30:00", "+01:00"))).toBe(false);
  });

  it("refuses full or switched-off slots", () => {
    const early = berlin("2026-11-04T09:00:00", "+01:00");
    expect(isSlotOpenForBooking({ ...slot, booked: 5 }, early)).toBe(false);
    expect(isSlotOpenForBooking({ ...slot, isActive: false }, early)).toBe(false);
  });

  it("skips Sundays and holidays when generating", () => {
    // 2026-12-24 Thu … 2026-12-28 Mon: 25th + 26th are holidays, 27th is Sunday.
    expect(slotGenerationDates("2026-12-24", 5, [0])).toEqual(["2026-12-24", "2026-12-28"]);
  });
});
