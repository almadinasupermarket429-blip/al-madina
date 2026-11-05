import { describe, expect, it } from "vitest";
import { isAllowedImagePath } from "@/lib/images";

const base = "/img/f_auto,q_auto,c_limit,w_600";

describe("isAllowedImagePath", () => {
  it.each([
    `${base}/almadina/products/abc123xyz.jpg`,
    `${base}/v1712345678/almadina/products/abc123xyz.webp`,
    `${base}/sample.jpg`,
  ])("allows the site's own photo path %s", (p) => expect(isAllowedImagePath(p)).toBe(true));

  it.each([
    `${base}/w_8000/almadina/products/x.jpg`, // extra width after ours
    `${base}/c_scale/h_9000/almadina/products/x.jpg`,
    `${base}/e_blur:2000,w_4000/x.jpg`,
    `/img/f_auto,q_auto,c_limit,w_601/x.jpg`, // width not in the list
    `${base}/almadina/products/x`, // no image file
    `${base}/../x.jpg`,
    `${base}//x.jpg`,
  ])("refuses %s", (p) => expect(isAllowedImagePath(p)).toBe(false));
});
