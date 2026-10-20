import { test, expect } from "@playwright/test";

test("homepage loads with German as the default language", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.getByText("Ihr arabischer & türkischer Markt,")).toBeVisible();
  // .first(): a "Top rated" / "Recently viewed" grid can follow the main catalog grid.
  await expect(page.locator(".product-grid").first()).toBeVisible({ timeout: 15_000 });
});

test("language toggle switches to English and persists across navigation", async ({ page }) => {
  await page.goto("/");
  await page.locator(".language-btn").click();
  await expect(page.getByText("Your Arabic & Turkish market,")).toBeVisible();

  // Persistence is via a shared context + localStorage, not per-page state —
  // this is what "translate everything" actually required.
  await page.goto("/track");
  await expect(page.getByText("Track your order")).toBeVisible();
});

// Both tests below target one real catalog product by its exact name rather than
// the positionally-"first" card: the admin product-CRUD test (tests/admin.spec.ts)
// creates and deletes its own product concurrently, and a "first()" locator could
// land on it just before it is deleted. This product belongs to the "Reis" category,
// which is sorted first, so it is always on the first page of the grid.
export const STABLE_PRODUCT_TEXT = "Durra Indischer Basmati-Reis Sella XXL";

test("add to cart updates the cart badge and drawer", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".product-grid .product-card");

  await page.locator(".product-grid").first().locator(".product-card", { hasText: STABLE_PRODUCT_TEXT }).locator(".add-btn").click();

  // First /api/cart call compiles the route on the dev server.
  await expect(page.locator(".cart-btn i")).toHaveText("1", { timeout: 15_000 });

  await page.locator(".cart-btn").click();
  await expect(page.locator(".cart-drawer")).toBeVisible();
  await expect(page.locator(".cart-item")).toHaveCount(1);
});

test("product detail page loads via a real product link", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".product-grid .product-card");
  await page.locator(".product-card", { hasText: STABLE_PRODUCT_TEXT }).locator(".product-image").click();

  const modal = page.locator(".checkout-modal");
  await expect(modal).toBeVisible();
  await expect(modal.locator(".primary-btn")).toBeVisible();
});

test("legal pages are reachable from the footer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Impressum" }).click();
  // Client-side navigation waits for the dev server to compile /impressum on first visit.
  await expect(page).toHaveURL(/\/impressum/, { timeout: 20_000 });
  await expect(page.locator("h1")).toHaveText("Impressum");
});

test("404 page is branded, not the default Next.js page", async ({ page }) => {
  const res = await page.goto("/this-page-does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Seite nicht gefunden")).toBeVisible();
});
