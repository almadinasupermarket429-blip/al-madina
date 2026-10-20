import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customer-auth";

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
  if (!productId) {
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
  const { productId, rating, title, comment } = body as {
    productId?: string;
    rating?: number;
    title?: string;
    comment?: string;
  };

  if (!productId || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "productId und eine Bewertung von 1-5 sind erforderlich." }, { status: 400 });
  }

  const product = await prisma.$queryRaw<{ id: string }[]>`select id from products where id = ${productId}::uuid limit 1`;
  if (!product[0]) return NextResponse.json({ error: "Produkt nicht gefunden." }, { status: 404 });

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
