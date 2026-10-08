import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isOwner } from "@/lib/auth";
import { generateSlots, listSlots } from "@/lib/slots";

const TIME = /^\d{2}:\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Any admin can see the slot board (staff use it to plan packing).
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  return NextResponse.json(await listSlots({ onlyBookable: false }));
}

// Owner only. Either a single slot { date, start, end, capacity }
// or a bulk generate { generate: { fromDate, days, windows, capacity, skipWeekdays } }.
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });

  const body = await req.json().catch(() => ({}));

  if (body.generate) {
    const g = body.generate;
    const windows = Array.isArray(g.windows) ? g.windows.filter((w: { start: string; end: string }) => TIME.test(w?.start) && TIME.test(w?.end) && w.end > w.start) : [];
    const days = Math.floor(Number(g.days));
    const capacity = Math.floor(Number(g.capacity));
    if (!DATE.test(g.fromDate) || !(days >= 1 && days <= 60) || windows.length === 0 || !(capacity >= 1 && capacity <= 500)) {
      return NextResponse.json({ error: "Bitte Startdatum, 1–60 Tage, mindestens ein gültiges Zeitfenster und eine Kapazität angeben." }, { status: 400 });
    }
    const skip = Array.isArray(g.skipWeekdays) ? g.skipWeekdays.map(Number).filter((n: number) => n >= 0 && n <= 6) : [];
    const created = await generateSlots({ fromDate: g.fromDate, days, windows, capacity, skipWeekdays: skip });
    return NextResponse.json({ created, slots: await listSlots({ onlyBookable: false }) }, { status: 201 });
  }

  const { date, start, end } = body;
  const capacity = Math.floor(Number(body.capacity));
  if (!DATE.test(date) || !TIME.test(start) || !TIME.test(end) || end <= start || !(capacity >= 1 && capacity <= 500)) {
    return NextResponse.json({ error: "Ungültiges Datum, Zeitfenster oder Kapazität." }, { status: 400 });
  }
  await prisma.$executeRaw`
    insert into delivery_slots (slot_date, start_time, end_time, capacity)
    values (${date}::date, ${start}::time, ${end}::time, ${capacity})
    on conflict (slot_date, start_time, end_time) do update set capacity = excluded.capacity, is_active = true
  `;
  return NextResponse.json({ created: 1, slots: await listSlots({ onlyBookable: false }) }, { status: 201 });
}
