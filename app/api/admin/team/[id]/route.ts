import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isOwner } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";

// Removes admin access only (deletes the admin_users role row) — the
// underlying users account, and any customer history on it, is untouched.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });

  const { id } = await params;
  if (id === session?.adminId) {
    return NextResponse.json({ error: "Sie können Ihr eigenes Konto nicht entfernen, während Sie damit angemeldet sind." }, { status: 400 });
  }

  const removed = await prisma.$executeRaw`delete from admin_users where user_id = ${id}::uuid`.catch(() => 0);
  if (removed) await logAdminAction(session, "team.remove", "team", id, `Team-Zugang entfernt (Konto ${id.slice(0, 8)})`);
  return NextResponse.json({ ok: true });
}
