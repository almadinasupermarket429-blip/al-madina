import { NextResponse } from "next/server";
import { getStoreSettings } from "@/lib/settings";
import { listSlots } from "@/lib/slots";

// Public: what the storefront needs to render checkout — fees, minimums,
// which fulfillment options are on, the banner, and bookable time slots.
export async function GET() {
  const [settings, slots] = await Promise.all([getStoreSettings(), listSlots({ onlyBookable: true })]);
  return NextResponse.json({
    settings,
    slots: slots.slice(0, 60).map((s) => ({ id: s.id, date: s.date, start: s.start, end: s.end, remaining: s.capacity - s.booked })),
  });
}
