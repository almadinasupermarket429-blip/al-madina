import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isOwner } from "@/lib/auth";
import { listSlots } from "@/lib/slots";

// Owner only: change capacity or switch a slot on/off.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (body.capacity !== undefined) {
    const capacity = Math.floor(Number(body.capacity));
    if (!(capacity >= 1 && capacity <= 500)) return NextResponse.json({ error: "Ungültige Kapazität." }, { status: 400 });
    await prisma.$executeRaw`update delivery_slots set capacity = ${capacity} where id = ${id}::uuid`;
  }
  if (typeof body.isActive === "boolean") {
    await prisma.$executeRaw`update delivery_slots set is_active = ${body.isActive} where id = ${id}::uuid`;
  }
  return NextResponse.json(await listSlots({ onlyBookable: false }));
}

// Owner only: delete a slot. Slots with bookings are deactivated instead, so
// those orders keep showing their time window.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });
  const { id } = await params;

  const booked = await prisma.$queryRaw<{ n: bigint }[]>`select count(*) as n from orders where delivery_slot_id = ${id}::uuid`;
  if (Number(booked[0]?.n ?? 0) > 0) {
    await prisma.$executeRaw`update delivery_slots set is_active = false where id = ${id}::uuid`;
  } else {
    await prisma.$executeRaw`delete from delivery_slots where id = ${id}::uuid`;
  }
  return NextResponse.json(await listSlots({ onlyBookable: false }));
}
