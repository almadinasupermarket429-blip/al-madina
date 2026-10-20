import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customer-auth";
import { getAdminSession, isOwner } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [customerSession, adminSession] = await Promise.all([getCustomerSession(), getAdminSession()]);

  const review = await prisma.$queryRaw<{ id: string; user_id: string }[]>`
    select id, user_id from reviews where id = ${id}::uuid limit 1
  `;
  if (!review[0]) return NextResponse.json({ error: "Bewertung nicht gefunden." }, { status: 404 });

  const isOwnerCustomer = customerSession && review[0].user_id === customerSession.userId;
  if (!isOwnerCustomer && !isOwner(adminSession)) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  await prisma.$executeRaw`delete from reviews where id = ${id}::uuid`;
  if (!isOwnerCustomer) await logAdminAction(adminSession, "review.delete", "review", id, "Bewertung entfernt");
  return NextResponse.json({ ok: true });
}
