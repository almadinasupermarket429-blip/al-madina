// Set from CLOUDINARY_CLOUD_NAME in next.config.ts. Read per call (not at import) so it also works in tests.
function cloudinaryPrefix(): string | null {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  return cloud ? `https://res.cloudinary.com/${cloud}/image/upload/` : null;
}

/**
 * Turns a stored Cloudinary URL into a resized image served through our own domain
 * (/img/..., proxied in next.config.ts), so visitors never connect to Cloudinary directly.
 * Other URLs are returned unchanged.
 */
export function sizedImage(url: string | null | undefined, width: number): string {
  if (!url) return "";
  const prefix = cloudinaryPrefix();
  if (!prefix || !url.startsWith(prefix)) return url;
  // Drop any transformation already in the stored URL ("f_auto,q_auto/") and set our own.
  const rest = url.slice(prefix.length).replace(/^(?:[a-z]_[^/]*\/)+/, "");
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
