const CLOUDINARY_PREFIX = "https://res.cloudinary.com/a2x0mlwu/image/upload/";

/**
 * Turns a stored Cloudinary URL into a resized image served through our own domain
 * (/img/..., proxied in next.config.ts), so visitors never connect to Cloudinary directly.
 * Other URLs are returned unchanged.
 */
export function sizedImage(url: string | null | undefined, width: number): string {
  if (!url) return "";
  if (!url.startsWith(CLOUDINARY_PREFIX)) return url;
  // Drop any transformation already in the stored URL ("f_auto,q_auto/") and set our own.
  const rest = url.slice(CLOUDINARY_PREFIX.length).replace(/^(?:[a-z]_[^/]*\/)+/, "");
  return `/img/f_auto,q_auto,c_limit,w_${width}/${rest}`;
}

/** Absolute image URL for places outside the browser (search engines, social previews). */
export function absoluteImage(url: string | null | undefined, width: number): string {
  if (!url) return "";
  const path = sizedImage(url, width);
  if (!path.startsWith("/")) return path;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  return `${site}${path}`;
}
