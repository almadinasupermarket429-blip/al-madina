import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isOwner } from "@/lib/auth";

type Entry = { id: string; createdAt: Date; actor: string; action: string; entity: string; entityId: string | null; summary: string; details: unknown };

// Owner only: the activity log, newest first, 50 per page.
//   ?before=<id> for the next page, ?entity=product|variant|order|customer|settings|… to filter, ?q= to search
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const before = Number(sp.get("before"));
  const entity = sp.get("entity");
  const q = sp.get("q")?.trim();
  const conditions: Prisma.Sql[] = [];
  if (Number.isInteger(before) && before > 0) conditions.push(Prisma.sql`id < ${before}`);
  if (entity && /^[a-z_]{1,30}$/.test(entity)) conditions.push(Prisma.sql`entity = ${entity}`);
  if (q) conditions.push(Prisma.sql`(summary ilike ${"%" + q + "%"} or actor ilike ${"%" + q + "%"})`);
  const where = conditions.length ? Prisma.sql`where ${Prisma.join(conditions, " and ")}` : Prisma.empty;

  const rows = await prisma.$queryRaw<Entry[]>`
    select id::text as id, created_at as "createdAt", actor, action, entity, entity_id as "entityId", summary, details
    from admin_audit_log ${where}
    order by id desc limit 51
  `;
  return NextResponse.json({ entries: rows.slice(0, 50), hasMore: rows.length > 50 });
}
