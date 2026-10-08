// app/api/account/addresses/route.ts
//
// CONTRACT CHANGE: the old Address model stored one free-text `address`
// field. The new schema splits it into line1/line2/city/postalCode, plus
// latitude/longitude for the distance-based delivery fee. The account
// page's "add address" form currently posts { label, address, isDefault }
// and will need a small update to collect these fields separately (and
// ideally geocode them) — the request body below is what it should send
// once that's done.

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

  if (!label || !line1 || !city || !postalCode) {
    return NextResponse.json(
      { error: "Bezeichnung, Straße, Stadt und Postleitzahl sind erforderlich." },
      { status: 400 }
    );
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
