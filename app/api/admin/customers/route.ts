import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isOwner } from "@/lib/auth";

type CustomerRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: Date;
  emailVerified: boolean;
  orderCount: bigint;
  totalSpent: string | null;
  lastOrderAt: Date | null;
  addressCount: bigint;
};

// Owner only: customer list with lifetime order stats. ?q= searches name/email/phone.
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  const like = q ? `%${q.replace(/[%_\\]/g, (c) => "\\" + c)}%` : null;
  const search = like
    ? Prisma.sql`and (u.full_name ilike ${like} or u.email ilike ${like} or u.phone ilike ${like})`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<CustomerRow[]>`
    select u.id, u.full_name as name, u.email, u.phone, u.created_at as "createdAt",
           (u.email_verified_at is not null) as "emailVerified",
           count(o.id) filter (where o.status <> 'CANCELLED') as "orderCount",
           sum(o.total) filter (where o.status <> 'CANCELLED') as "totalSpent",
           max(o.created_at) as "lastOrderAt",
           (select count(*) from addresses a where a.user_id = u.id) as "addressCount"
    from users u
    left join orders o on o.user_id = u.id
    where u.deleted_at is null ${search}
    group by u.id
    order by max(o.created_at) desc nulls last, u.created_at desc
    limit 500
  `;

  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      orderCount: Number(r.orderCount),
      totalSpent: Number(r.totalSpent ?? 0),
      addressCount: Number(r.addressCount),
    }))
  );
}
