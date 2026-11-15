import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

const SITE_URL = siteUrl();

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
