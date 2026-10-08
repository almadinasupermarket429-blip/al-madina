import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, isOwner } from "@/lib/auth";
import { listCategories, resolveCategoryId } from "@/lib/catalog-admin";

export async function GET() {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });
  return NextResponse.json(await listCategories());
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });
  const { name } = await req.json().catch(() => ({}));
  if (!name || typeof name !== "string" || name.trim().length > 60) {
    return NextResponse.json({ error: "Bitte einen Kategorienamen (max. 60 Zeichen) angeben." }, { status: 400 });
  }
  await resolveCategoryId(name);
  return NextResponse.json(await listCategories(), { status: 201 });
}
