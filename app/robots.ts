import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private / per-user / tokenised pages have no business in search results.
      disallow: ["/admin", "/api/", "/account", "/cart", "/deliver/", "/track"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
