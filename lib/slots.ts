// lib/slots.ts — bookable delivery / pickup time windows (delivery_slots table).
//
// A slot's remaining capacity is its capacity minus the non-cancelled
// orders booked into it, computed live rather than stored.

import { prisma } from "./prisma";

type Slot = {
  id: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  end: string; // HH:MM
  capacity: number;
  booked: number;
  isActive: boolean;
};

type SlotRow = { id: string; date: string; start: string; end: string; capacity: number; booked: bigint; isActive: boolean };

function shape(r: SlotRow): Slot {
  return { ...r, start: r.start.slice(0, 5), end: r.end.slice(0, 5), booked: Number(r.booked) };
}

/** Slots from today onward. `onlyBookable` hides inactive, full and already-started slots (storefront view). */
export async function listSlots({ onlyBookable }: { onlyBookable: boolean }): Promise<Slot[]> {
  const rows = await prisma.$queryRaw<SlotRow[]>`
    select s.id, to_char(s.slot_date, 'YYYY-MM-DD') as date, s.start_time::text as start, s.end_time::text as "end",
           s.capacity, s.is_active as "isActive",
           (select count(*) from orders o where o.delivery_slot_id = s.id and o.status <> 'CANCELLED') as booked
    from delivery_slots s
    where s.slot_date >= (now() at time zone 'Europe/Berlin')::date
    order by s.slot_date, s.start_time
  `;
  const slots = rows.map(shape);
  if (!onlyBookable) return slots;

  const berlinNow = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date()); // "YYYY-MM-DD HH:MM"
  return slots.filter((s) => s.isActive && s.booked < s.capacity && `${s.date} ${s.start}` > berlinNow);
}

export async function isSlotBookable(slotId: string): Promise<boolean> {
  const slots = await listSlots({ onlyBookable: true });
  return slots.some((s) => s.id === slotId);
}

export async function hasBookableSlots(): Promise<boolean> {
  return (await listSlots({ onlyBookable: true })).length > 0;
}

/**
 * Bulk-creates the same set of time windows for each day in a date range,
 * skipping weekdays in `skipWeekdays` (0 = Sunday) and any window that already exists.
 */
export async function generateSlots(opts: {
  fromDate: string;
  days: number;
  windows: { start: string; end: string }[];
  capacity: number;
  skipWeekdays: number[];
}): Promise<number> {
  let created = 0;
  const start = new Date(`${opts.fromDate}T12:00:00Z`);
  for (let i = 0; i < opts.days; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    if (opts.skipWeekdays.includes(d.getUTCDay())) continue;
    const date = d.toISOString().slice(0, 10);
    for (const w of opts.windows) {
      created += await prisma.$executeRaw`
        insert into delivery_slots (slot_date, start_time, end_time, capacity)
        values (${date}::date, ${w.start}::time, ${w.end}::time, ${opts.capacity})
        on conflict (slot_date, start_time, end_time) do nothing
      `;
    }
  }
  return created;
}
