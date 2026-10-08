import { test, expect } from "@playwright/test";
import { deleteUserByEmail } from "./helpers/test-customer";

test("visit section shows the real store details from the Google listing", async ({ page }) => {
  await page.goto("/");
  const visit = page.locator("#visit");
  await expect(visit.getByText("سوبر ماركت وملحمة المدينة")).toBeVisible();
  await expect(visit.getByText("Landwehrstraße 12").first()).toBeVisible();
  await expect(visit.getByText(/26QC\+WJ/)).toBeVisible();
  await expect(visit.getByText("Abholung am Straßenrand")).toBeVisible();
  // Mon–Sat 07–20, Sunday closed — one row per weekday.
  await expect(visit.locator(".hours span", { hasText: "Montag" })).toContainText("07:00 — 20:00");
  await expect(visit.locator(".hours span", { hasText: "Sonntag" })).toContainText("Geschlossen");
  await expect(visit.locator('a[href="tel:+491638707437"]')).toBeVisible();
});

test("robots.txt keeps private areas out and points at the sitemap", async ({ request }) => {
  const res = await request.get("/robots.txt");
  expect(res.ok()).toBeTruthy();
  const body = await res.text();
  expect(body).toContain("Disallow: /admin");
  expect(body).toContain("Disallow: /account");
  expect(body).toMatch(/Sitemap: .*\/sitemap\.xml/);
});

test("sitemap lists product pages", async ({ request }) => {
  const res = await request.get("/sitemap.xml");
  expect(res.ok()).toBeTruthy();
  expect(await res.text()).toMatch(/\/products\/[a-z0-9-]+<\/loc>/);
});

test("product page has a title and Product structured data", async ({ page, request }) => {
  const products: { slug: string; name: string }[] = await (await request.get("/api/products")).json();
  const product = products.find((p) => p.slug);
  test.skip(!product, "no products in the catalog");
  await page.goto(`/products/${product!.slug}`);
  await expect(page).toHaveTitle(new RegExp(product!.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.some((s) => s.includes('"@type":"Product"'))).toBeTruthy();
  expect(ld.some((s) => s.includes('"@type":"GroceryStore"'))).toBeTruthy();
});

test("public store endpoint exposes checkout settings", async ({ request }) => {
  const res = await request.get("/api/store");
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(typeof data.settings.deliveryFee).toBe("number");
  expect(typeof data.settings.acceptingOrders).toBe("boolean");
  expect(Array.isArray(data.slots)).toBeTruthy();
});

test("coupon checks require a customer login (no anonymous code guessing)", async ({ request }) => {
  const res = await request.post("/api/coupons/validate", { data: { code: "DOES-NOT-EXIST-123", subtotal: 50 } });
  expect(res.status()).toBe(401);
  expect((await res.json()).error).toMatch(/melden Sie sich an/i);
});

test("sign-up answers the same for new and existing emails (no account enumeration)", async ({ request }) => {
  const unique = `pw-signup-${Date.now()}@example.com`;
  const body = (email: string) => ({ name: "Playwright", email, password: "Playwright-Test-1" });
  const fresh = await request.post("/api/account/register", { data: body(unique) });
  const again = await request.post("/api/account/register", { data: body(unique) });
  try {
    expect(fresh.status()).toBe(200);
    expect(again.status()).toBe(200);
    expect(await again.json()).toEqual(await fresh.json());
    // No session until the emailed code is entered.
    expect((await (await request.get("/api/account/me")).json()).user).toBeNull();
  } finally {
    await deleteUserByEmail(unique);
  }
});

test("forgot-password gives the same answer for unknown emails (no account enumeration)", async ({ request }) => {
  const res = await request.post("/api/account/forgot-password", { data: { email: `nobody-${Date.now()}@example.com` } });
  expect(res.ok()).toBeTruthy();
  expect((await res.json()).message).toMatch(/Falls ein Konto/);
});

test("sign-in form links to the forgot-password flow", async ({ page }) => {
  await page.goto("/account");
  await page.getByRole("button", { name: "Passwort vergessen?" }).click();
  await expect(page.getByRole("heading", { name: "Passwort vergessen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Link senden" })).toBeVisible();
});

test("reset-password page rejects a bogus token", async ({ page }) => {
  await page.goto("/account/reset-password?token=not-a-real-token");
  // The token check is a cold-compiled API call on the dev server.
  await expect(page.getByText("Dieser Link ist ungültig oder abgelaufen.")).toBeVisible({ timeout: 15_000 });
});

test("cart drawer shows free-delivery progress", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".product-grid .product-card");
  const store = await (await page.request.get("/api/store")).json();
  test.skip(!(store.settings.deliveryEnabled && store.settings.freeDeliveryThreshold > 0), "free delivery disabled in settings");

  await page.locator(".product-card", { hasText: "Coffee" }).locator(".add-btn").click();
  await expect(page.locator(".cart-btn i")).toHaveText("1");
  await page.locator(".cart-btn").click();
  await expect(page.locator(".free-delivery .progress")).toBeVisible();
});
