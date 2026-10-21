// Visual regression ("UI") tests: compare key screens against approved screenshots.
// Approve new looks with: npx playwright test visual --update-snapshots
// Baselines are per operating system (fonts render differently), so they're stored per platform.
import { test, expect, type Page } from "@playwright/test";

// Things that legitimately change between runs (time-of-day badge, review counts, the cookie banner).
const dynamic = (page: Page) => [page.locator(".open-badge"), page.locator(".cookie-notice"), page.locator(".product-card small")];

async function settle(page: Page) {
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important} .reveal{opacity:1!important;transform:none!important}" });
  await page.evaluate(() => document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible")));
  await page.waitForLoadState("networkidle");
}

test.describe("visual", () => {
  test.beforeEach(async ({ page }) => {
    // The notice is dismissed so it doesn't cover the page in screenshots.
    await page.addInitScript(() => localStorage.setItem("almadina_cookie_notice_ack", "1"));
  });

  test("homepage hero", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await expect(page).toHaveScreenshot("home-hero.png", { mask: dynamic(page), maxDiffPixelRatio: 0.02 });
  });

  test("product grid (first row)", async ({ page }) => {
    await page.goto("/#shop");
    await page.waitForSelector(".product-grid .product-card img");
    await settle(page);
    const firstCards = page.locator(".product-grid").first();
    await firstCards.scrollIntoViewIfNeeded();
    await expect(page.locator("#shop .section-head")).toHaveScreenshot("shop-heading.png", { maxDiffPixelRatio: 0.02 });
    await expect(page.locator(".product-grid .product-card").first()).toHaveScreenshot("product-card.png", { mask: dynamic(page), maxDiffPixelRatio: 0.03 });
  });

  test("product detail popup", async ({ page }) => {
    await page.goto("/");
    await page.locator(".product-card", { hasText: "Durra Indischer Basmati-Reis Sella XXL" }).first().locator(".product-image").click();
    const modal = page.locator(".checkout-modal");
    await expect(modal.locator(".pd-specs")).toBeVisible();
    await settle(page);
    await expect(modal).toHaveScreenshot("product-modal.png", { mask: [modal.locator(".pg-main img")], maxDiffPixelRatio: 0.03 });
  });

  test("privacy policy page", async ({ page }) => {
    await page.goto("/datenschutz");
    await settle(page);
    await expect(page.locator("main")).toHaveScreenshot("datenschutz.png", { maxDiffPixelRatio: 0.02 });
  });
});
