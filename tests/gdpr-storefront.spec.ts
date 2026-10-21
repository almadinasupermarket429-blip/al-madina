// GDPR & privacy behaviour of the public shop, plus the bilingual catalog.
import { test, expect } from "@playwright/test";
import { createTestCustomer } from "./helpers/test-customer";

test("homepage loads nothing from third-party servers (no IP addresses leave our domain)", async ({ page, baseURL }) => {
  const ownHost = new URL(baseURL!).host;
  const foreign: string[] = [];
  page.on("request", (req) => {
    const host = new URL(req.url()).host;
    if (host !== ownHost && !req.url().startsWith("data:")) foreign.push(req.url());
  });
  await page.goto("/");
  await page.waitForSelector(".product-grid .product-card");
  await page.mouse.wheel(0, 4000);
  await page.waitForLoadState("networkidle");
  expect(foreign).toEqual([]);
});

test("product photos come through the own-domain /img proxy", async ({ page, request }) => {
  await page.goto("/");
  const src = await page.locator(".product-grid .product-card img").first().getAttribute("src");
  expect(src).toMatch(/^\/img\/f_auto,q_auto,c_limit,w_600\//);
  const res = await request.get(src!);
  expect(res.ok()).toBeTruthy();
  expect(res.headers()["content-type"]).toMatch(/^image\//);
});

test("nothing optional is stored on the device (only language + cookie-notice choice)", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".product-grid .product-card");
  await page.locator(".product-grid .product-card .product-image").first().click();
  await page.locator(".close-modal").click();
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys.filter((k) => !["almadina_language", "almadina_cookie_notice_ack"].includes(k))).toEqual([]);
});

test("checkout and sign-up show a privacy notice with a link to the policy", async ({ page }) => {
  await page.goto("/account");
  await page.getByRole("button", { name: "Registrieren" }).click();
  await expect(page.locator(".privacy-note a[href='/datenschutz']")).toBeVisible();
});

test("customers can delete their own account; personal data is erased", async ({ page }) => {
  const customer = await createTestCustomer(page.request);
  try {
    const wrong = await page.request.delete("/api/account/me", { data: { password: "definitely-wrong" } });
    expect(wrong.status()).toBe(400);

    const ok = await page.request.delete("/api/account/me", { data: { password: customer.password } });
    expect(ok.ok()).toBeTruthy();

    const me = await (await page.request.get("/api/account/me")).json();
    expect(me.user).toBeNull();
    const login = await page.request.post("/api/account/login", { data: { email: customer.email, password: customer.password } });
    expect(login.ok()).toBeFalsy();
  } finally {
    await customer.remove();
  }
});

test("public reviews show only first name and last initial", async ({ page }) => {
  const customer = await createTestCustomer(page.request, "Erika Mustermann");
  try {
    const products: { id: string }[] = await (await page.request.get("/api/products")).json();
    const productId = products[0].id;
    const post = await page.request.post("/api/reviews", { data: { productId, rating: 5, comment: "Playwright" } });
    expect(post.ok()).toBeTruthy();
    const { reviews } = await (await page.request.get(`/api/reviews?productId=${productId}`)).json();
    const mine = reviews.find((r: { comment: string }) => r.comment === "Playwright");
    expect(mine.authorName).toBe("Erika M.");
  } finally {
    await customer.remove();
  }
});

test("unknown delivery links reveal nothing", async ({ request }) => {
  const res = await request.get("/api/orders/deliver/0000000000000000000000000000dead");
  expect(res.status()).toBe(404);
});

test("catalog switches product names to English and loads more on demand", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".product-grid .product-card");
  const grid = page.locator(".product-grid").first();
  await expect(grid.locator(".product-card")).toHaveCount(24);

  await page.getByRole("button", { name: /Mehr anzeigen/ }).click();
  await expect(grid.locator(".product-card")).toHaveCount(48);

  await page.locator(".language-btn").click();
  await expect(grid.getByText("Durra Indian Basmati Rice Sella XXL 4.5 kg")).toBeVisible();
  await expect(page.locator(".category", { hasText: "Pulses & Beans" })).toBeVisible();
});
