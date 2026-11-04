// app/api/account/addresses/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customer-auth";
import { isUuid } from "@/lib/orders";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Adresse nicht gefunden." }, { status: 404 });

  const deleted = await prisma.$executeRaw`
    delete from addresses where id = ${id}::uuid and user_id = ${session.userId}::uuid
  `;

  if (deleted === 0) return NextResponse.json({ error: "Adresse nicht gefunden." }, { status: 404 });

  return NextResponse.json({ ok: true });
}
