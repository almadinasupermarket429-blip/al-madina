// Set from CLOUDINARY_CLOUD_NAME in next.config.ts. Read per call (not at import) so it also works in tests.
function cloudinaryPrefix(): string | null {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  return cloud ? `https://res.cloudinary.com/${cloud}/image/upload/` : null;
}

/** The only resize widths the site asks for. /img refuses any other transformation (see middleware.ts),
 * so strangers can't make the shop's Cloudinary account render (and bill) arbitrary variants. */
const IMAGE_WIDTHS = [160, 200, 240, 600, 900, 1200, 2000] as const;
type ImageWidth = (typeof IMAGE_WIDTHS)[number];

const IMG_PATH = new RegExp(`^/img/f_auto,q_auto,c_limit,w_(${IMAGE_WIDTHS.join("|")})/[A-Za-z0-9_./-]+$`);

/** Shown in the product gallery for products without a photo: the shop logo. */
export const PLACEHOLDER_IMAGE = "/logo.png";

/** A Cloudinary transformation segment ("w_8000", "c_scale", "h_9000,c_fill") or anything with a comma. */
const TRANSFORMATION_SEGMENT = /^[a-z]{1,3}_|,/;
const IMAGE_FILE = /\.(jpe?g|png|webp|gif|avif)$/i;

/**
 * True for /img paths the site itself generates: our fixed transformation, then only the photo's
 * own path (optional "v123/", folders, a file name with an image extension). Extra segments that
 * look like transformations are refused, or "/w_600/w_8000/..." would still render any size.
 */
export function isAllowedImagePath(pathname: string): boolean {
  if (!IMG_PATH.test(pathname) || pathname.includes("..")) return false;
  const rest = pathname.split("/").slice(3); // ["", "img", "f_auto,...,w_600", ...rest]
  if (rest.length === 0 || !IMAGE_FILE.test(rest[rest.length - 1])) return false;
  return rest.every((seg) => seg !== "" && !TRANSFORMATION_SEGMENT.test(seg));
}

/**
 * Turns a stored Cloudinary URL into a resized image served through our own domain
 * (/img/..., proxied in next.config.ts), so visitors never connect to Cloudinary directly.
 * Other URLs are returned unchanged.
 */
export function sizedImage(url: string | null | undefined, width: ImageWidth): string {
  if (!url) return "";
  const prefix = cloudinaryPrefix();
  if (!prefix || !url.startsWith(prefix)) return url;
  // Drop any transformation already in the stored URL ("f_auto,q_auto/") and set our own.
  const rest = url.slice(prefix.length).replace(/^(?:[a-z]_[^/]*\/)+/, "");
  return `/img/f_auto,q_auto,c_limit,w_${width}/${rest}`;
}

/** Absolute image URL for places outside the browser (search engines, social previews). */
export function absoluteImage(url: string | null | undefined, width: ImageWidth): string {
  if (!url) return "";
  const path = sizedImage(url, width);
  if (!path.startsWith("/")) return path;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  return `${site}${path}`;
}
