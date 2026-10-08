import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Rebuilt at most once an hour, so new products show up without a redeploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await prisma.$queryRaw<{ slug: string; updated_at: Date }[]>`
    select p.slug, p.updated_at
    from products p
    left join categories c on c.id = p.category_id
    where p.is_active = true and coalesce(c.is_active, true)
    order by p.updated_at desc
  `.catch(() => []);

  return [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    ...products.map((p) => ({
      url: `${SITE_URL}/products/${p.slug}`,
      lastModified: p.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    { url: `${SITE_URL}/impressum`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${SITE_URL}/datenschutz`, changeFrequency: "yearly", priority: 0.1 },
  ];
}
