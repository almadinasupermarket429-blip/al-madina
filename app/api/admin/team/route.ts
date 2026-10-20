import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isOwner } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";

// admin_users is a role marker (user_id, role) on top of users — the actual
// account (email, password, name) lives in users, shared with the customer
// login. See lib/auth.ts's getAdminSession() for the same join.
type TeamAccount = { id: string; email: string; name: string; role: "OWNER" | "STAFF"; createdAt: Date };

export async function GET() {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });

  const accounts = await prisma.$queryRaw<TeamAccount[]>`
    select u.id, u.email, u.full_name as "name", a.role, a.created_at as "createdAt"
    from admin_users a
    join users u on u.id = a.user_id
    order by a.created_at asc
  `;
  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });

  const { name, email, password, role } = await req.json().catch(() => ({}));
  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, E-Mail und Passwort sind erforderlich." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Das Passwort muss mindestens 8 Zeichen lang sein." }, { status: 400 });
  }
  if (role !== "OWNER" && role !== "STAFF") {
    return NextResponse.json({ error: "Rolle muss OWNER oder STAFF sein." }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existingAdmin = await prisma.$queryRaw<{ user_id: string }[]>`
    select a.user_id from admin_users a join users u on u.id = a.user_id where u.email = ${normalizedEmail} limit 1
  `;
  if (existingAdmin[0]) {
    return NextResponse.json({ error: "Ein Admin-Konto mit dieser E-Mail existiert bereits." }, { status: 409 });
  }

  // If they already have a customer account, grant admin on it (shared login) —
  // otherwise create a fresh account with the given password.
  const existingUser = await prisma.$queryRaw<{ id: string }[]>`
    select id from users where email = ${normalizedEmail} and deleted_at is null limit 1
  `;

  const userId = await prisma.$transaction(async (tx) => {
    if (existingUser[0]) return existingUser[0].id;
    const passwordHash = await bcrypt.hash(password, 10);
    const created = await tx.$queryRaw<{ id: string }[]>`
      insert into users (email, password_hash, full_name) values (${normalizedEmail}, ${passwordHash}, ${name.trim()})
      returning id
    `;
    return created[0].id;
  });
  await prisma.$executeRaw`insert into admin_users (user_id, role) values (${userId}::uuid, ${role}::admin_role)`;

  const created = await prisma.$queryRaw<TeamAccount[]>`
    select u.id, u.email, u.full_name as "name", a.role, a.created_at as "createdAt"
    from admin_users a
    join users u on u.id = a.user_id
    where a.user_id = ${userId}::uuid
  `;
  await logAdminAction(session, "team.add", "team", userId, `Team-Zugang angelegt: ${created[0]?.email} (${role})`);
  return NextResponse.json(created[0], { status: 201 });
}
