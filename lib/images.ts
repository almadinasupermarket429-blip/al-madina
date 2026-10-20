/**
 * Returns a Cloudinary image URL resized to `width` pixels (2x for sharp phone screens is the
 * caller's job). Non-Cloudinary URLs are returned unchanged.
 */
export function sizedImage(url: string | null | undefined, width: number): string {
  if (!url) return "";
  if (!url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) return url;
  // Our product URLs already carry "f_auto,q_auto/"; add the width to that same step.
  if (url.includes("/image/upload/f_auto,q_auto/")) {
    return url.replace("/image/upload/f_auto,q_auto/", `/image/upload/f_auto,q_auto,c_limit,w_${width}/`);
  }
  return url.replace("/image/upload/", `/image/upload/f_auto,q_auto,c_limit,w_${width}/`);
}
