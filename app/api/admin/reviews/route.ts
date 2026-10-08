import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, isOwner } from "@/lib/auth";

// Owner only: every review, newest first, for moderation. Deleting goes
// through the existing DELETE /api/reviews/[id] (which already allows owners).
export async function GET() {
  const session = await getAdminSession();
  if (!isOwner(session)) return NextResponse.json({ error: "Inhaberzugriff erforderlich." }, { status: 403 });

  const rows = await prisma.$queryRaw<
    { id: string; rating: number; title: string | null; comment: string | null; createdAt: Date; authorName: string; authorEmail: string; productName: string; productSlug: string }[]
  >`
    select r.id, r.rating, r.title, r.comment, r.created_at as "createdAt",
           u.full_name as "authorName", u.email as "authorEmail",
           p.name as "productName", p.slug as "productSlug"
    from reviews r
    join users u on u.id = r.user_id
    join products p on p.id = r.product_id
    order by r.created_at desc
    limit 500
  `;
  return NextResponse.json(rows);
}
