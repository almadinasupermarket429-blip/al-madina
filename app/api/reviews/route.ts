import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customer-auth";
import { isEmailVerified } from "@/lib/email-verification";
import { isUuid } from "@/lib/orders";
import { rateLimit } from "@/lib/rate-limit";

type ReviewRow = {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  createdAt: Date;
  authorName: string;
};

/** "Ahmed Karimi" -> "Ahmed K." — reviews are public, so we don't publish full names. */
function publicName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Kunde";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

// Public: list reviews for a product, newest first, plus the average rating.
export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get("productId");
  if (!productId || !isUuid(productId)) {
    return NextResponse.json({ error: "productId ist erforderlich." }, { status: 400 });
  }

  const reviews = await prisma.$queryRaw<ReviewRow[]>`
    select r.id, r.rating, r.title, r.comment, r.created_at as "createdAt", u.full_name as "authorName"
    from reviews r
    join users u on u.id = r.user_id
    where r.product_id = ${productId}::uuid
    order by r.created_at desc
  `;

  const count = reviews.length;
  const average = count === 0 ? 0 : reviews.reduce((sum, r) => sum + r.rating, 0) / count;

  return NextResponse.json({
    average: Math.round(average * 10) / 10,
    count,
    reviews: reviews.map((r) => ({ ...r, authorName: publicName(r.authorName) })),
  });
}

// Customer only: leave one review per product.
export async function POST(req: NextRequest) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Bitte melden Sie sich an, um eine Bewertung abzugeben." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { productId, rating, title, comment } = body as Record<string, unknown>;

  // Reviews change the public rating, so only confirmed accounts may post, in whole stars, at a sane length and pace.
  if (!(await isEmailVerified(session.userId))) {
    return NextResponse.json({ error: "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.", code: "EMAIL_NOT_VERIFIED" }, { status: 403 });
  }
  if (typeof productId !== "string" || !isUuid(productId) || typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "productId und eine Bewertung von 1-5 sind erforderlich." }, { status: 400 });
  }
  if ((title != null && typeof title !== "string") || (comment != null && typeof comment !== "string")) {
    return NextResponse.json({ error: "Ungültige Angaben." }, { status: 400 });
  }
  if ((title ?? "").length > 120 || (comment ?? "").length > 2000) {
    return NextResponse.json({ error: "Titel höchstens 120, Text höchstens 2000 Zeichen." }, { status: 400 });
  }
  if (!(await rateLimit(`review:${session.userId}`, 10, 60 * 60_000)).allowed) {
    return NextResponse.json({ error: "Zu viele Bewertungen in kurzer Zeit. Bitte später erneut versuchen." }, { status: 429 });
  }

  const product = await prisma.$queryRaw<{ id: string }[]>`select id from products where id = ${productId}::uuid limit 1`;
  if (!product[0]) return NextResponse.json({ error: "Produkt nicht gefunden." }, { status: 404 });

  // Only customers who actually received the product may rate it, so throwaway accounts can't move the rating.
  const bought = await prisma.$queryRaw<{ n: bigint }[]>`
    select count(*) as n from orders o join order_items i on i.order_id = o.id
    where o.user_id = ${session.userId}::uuid and o.status = 'DELIVERED' and i.product_id = ${productId}::uuid
  `;
  if (Number(bought[0]?.n ?? 0) === 0) {
    return NextResponse.json(
      { error: "Bewerten können Sie Artikel, die Sie bei uns gekauft und erhalten haben.", code: "NOT_PURCHASED" },
      { status: 403 }
    );
  }

  try {
    const saved = await prisma.$queryRaw<{ id: string; rating: number; title: string | null; comment: string | null }[]>`
      insert into reviews (product_id, user_id, rating, title, comment)
      values (${productId}::uuid, ${session.userId}::uuid, ${rating}, ${title?.trim() || null}, ${comment?.trim() || null})
      on conflict (product_id, user_id) do update set
        rating = excluded.rating, title = excluded.title, comment = excluded.comment, updated_at = now()
      returning id, rating, title, comment
    `;
    return NextResponse.json(saved[0], { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ihre Bewertung konnte nicht gespeichert werden." }, { status: 500 });
  }
}
