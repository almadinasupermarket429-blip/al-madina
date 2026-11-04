// app/api/account/addresses/route.ts
// Saved delivery addresses: street (line1/line2), postcode and city stored separately.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customer-auth";

type AddressRow = {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  postalCode: string;
  latitude: string | null;
  longitude: string | null;
  isDefault: boolean;
};

export async function GET() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const addresses = await prisma.$queryRaw<AddressRow[]>`
    select id, label, line1, line2, city, postal_code as "postalCode",
           latitude, longitude, is_default as "isDefault"
    from addresses
    where user_id = ${session.userId}::uuid
    order by is_default desc, created_at desc
  `;

  return NextResponse.json(
    addresses.map((a) => ({
      ...a,
      latitude: a.latitude ? Number(a.latitude) : null,
      longitude: a.longitude ? Number(a.longitude) : null,
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const { label, line1, line2, city, postalCode, latitude, longitude, isDefault } = await req
    .json()
    .catch(() => ({}));

  if ([label, line1, line2, city, postalCode].some((v) => v != null && (typeof v !== "string" || v.length > 200))) {
    return NextResponse.json({ error: "Eine der Angaben ist zu lang." }, { status: 400 });
  }
  const coord = (v: unknown, limit: number) => v == null || (typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= limit);
  if (!coord(latitude, 90) || !coord(longitude, 180)) {
    return NextResponse.json({ error: "Ungültige Koordinaten." }, { status: 400 });
  }
  if (!label || !line1 || !city || !postalCode) {
    return NextResponse.json(
      { error: "Bezeichnung, Straße, Stadt und Postleitzahl sind erforderlich." },
      { status: 400 }
    );
  }

  const [count] = await prisma.$queryRaw<{ n: bigint }[]>`select count(*) as n from addresses where user_id = ${session.userId}::uuid`;
  if (Number(count?.n ?? 0) >= 20) {
    return NextResponse.json({ error: "Sie können höchstens 20 Adressen speichern." }, { status: 400 });
  }

  if (isDefault) {
    await prisma.$executeRaw`
      update addresses set is_default = false where user_id = ${session.userId}::uuid
    `;
  }

  const created = await prisma.$queryRaw<AddressRow[]>`
    insert into addresses (user_id, label, line1, line2, city, postal_code, latitude, longitude, is_default)
    values (
      ${session.userId}::uuid, ${label}, ${line1}, ${line2 || null}, ${city}, ${postalCode},
      ${latitude ?? null}, ${longitude ?? null}, ${!!isDefault}
    )
    returning id, label, line1, line2, city, postal_code as "postalCode",
              latitude, longitude, is_default as "isDefault"
  `;

  const address = created[0];
  return NextResponse.json(
    { ...address, latitude: address.latitude ? Number(address.latitude) : null, longitude: address.longitude ? Number(address.longitude) : null },
    { status: 201 }
  );
}
