import { test, expect, type Page } from "@playwright/test";
import { createTestCustomer } from "./helpers/test-customer";

async function loginAsOwner(page: Page) {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  test.skip(!username || !password, "ADMIN_USERNAME/ADMIN_PASSWORD not set in .env");
  await page.goto("/admin/login");
  await page.locator("form input").nth(0).fill(username!);
  await page.locator('input[type="password"]').fill(password!);
  await page.locator("form button").click();
  await page.waitForURL(/\/admin$/);
}

test.describe("admin store features", () => {
  test.beforeEach(async ({ page }) => loginAsOwner(page));

  test("every owner page is linked in the nav and loads", async ({ page }) => {
    // Eight pages, each compiled on first visit by the dev server.
    test.setTimeout(150_000);
    const pages: [string, string][] = [
      ["/admin/slots", "Zeitfenster"],
      ["/admin/categories", "Kategorien"],
      ["/admin/coupons", "Gutscheine"],
      ["/admin/customers", "Kunden"],
      ["/admin/reviews", "Bewertungen"],
      ["/admin/analytics", "Analyse"],
      ["/admin/team", "Team"],
      ["/admin/settings", "Einstellungen"],
      ["/admin/activity", "Aktivitätsprotokoll"],
    ];
    // Owner links render once /api/admin/me answers — wait for the last one before checking the rest.
    await expect(page.locator('aside a[href="/admin/settings"]').first()).toBeAttached({ timeout: 15_000 });
    for (const [href, heading] of pages) {
      await expect(page.locator(`aside a[href="${href}"]`).first()).toBeAttached();
      await page.goto(href);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible({ timeout: 15_000 });
    }
  });

  test("coupon lifecycle: create, validate at checkout price, delete", async ({ page }) => {
    // Touches four routes that the dev server compiles on first use.
    test.setTimeout(90_000);
    const code = `PW${Date.now().toString().slice(-8)}`;
    const create = await page.request.post("/api/admin/coupons", {
      data: { code, discountType: "PERCENT", discountValue: 10, minSubtotal: 20, oncePerCustomer: false },
    });
    expect(create.status()).toBe(201);
    const created = (await create.json()).find((c: { code: string }) => c.code === code);
    expect(created).toBeTruthy();

    // Coupon checks need a logged-in customer (the admin cookie doesn't count).
    const customer = await createTestCustomer(page.request);
    try {
      const unknown = await page.request.post("/api/coupons/validate", { data: { code: "DOES-NOT-EXIST-123", subtotal: 50 } });
      expect(unknown.status()).toBe(400);
      expect((await unknown.json()).error).toMatch(/ungültig/i);

      const tooSmall = await page.request.post("/api/coupons/validate", { data: { code, subtotal: 10 } });
      expect(tooSmall.status()).toBe(400);

      const ok = await page.request.post("/api/coupons/validate", { data: { code: code.toLowerCase(), subtotal: 50 } });
      expect(ok.ok()).toBeTruthy();
      expect((await ok.json()).discount).toBe(5);

      await page.goto("/admin/coupons");
      await expect(page.getByText(code)).toBeVisible();
    } finally {
      await page.request.delete(`/api/admin/coupons/${created.id}`);
      await customer.remove();
    }
  });

  test("shop banner set in settings appears on the storefront", async ({ page }) => {
    const before = await (await page.request.get("/api/admin/settings")).json();
    const banner = `Playwright-Banner ${Date.now()}`;
    try {
      const res = await page.request.patch("/api/admin/settings", { data: { announcement: banner } });
      expect(res.ok()).toBeTruthy();
      await page.goto("/");
      // The banner arrives via a client-side /api/store fetch after hydration.
      await expect(page.locator(".topbar")).toContainText(banner, { timeout: 15_000 });
    } finally {
      await page.request.patch("/api/admin/settings", { data: { announcement: before.announcement } });
    }
  });

  test("settings reject invalid values", async ({ page }) => {
    const res = await page.request.patch("/api/admin/settings", { data: { deliveryFee: -5 } });
    expect(res.status()).toBe(400);
  });

  test("time slots: generate far-future windows, then remove them", async ({ page }) => {
    const res = await page.request.post("/api/admin/slots", {
      data: { generate: { fromDate: "2031-03-03", days: 1, windows: [{ start: "10:00", end: "12:00" }], capacity: 3, skipWeekdays: [] } },
    });
    expect(res.status()).toBe(201);
    const { slots } = await res.json();
    const mine = slots.filter((s: { date: string }) => s.date === "2031-03-03");
    expect(mine.length).toBeGreaterThan(0);
    for (const s of mine) await page.request.delete(`/api/admin/slots/${s.id}`);
  });

  test("orders can be exported as CSV", async ({ page }) => {
    const res = await page.request.get("/api/orders?format=csv");
    expect(res.ok()).toBeTruthy();
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(await res.text()).toContain("Bestellnummer");
  });

  test("orders page has search and the online-orders switch", async ({ page }) => {
    await expect(page.getByLabel("Bestellungen durchsuchen")).toBeVisible();
    await expect(page.getByRole("switch", { name: "Online-Bestellungen annehmen" })).toBeVisible();
  });

  test("analytics supports 7/30/90-day ranges", async ({ page }) => {
    for (const days of [7, 30, 90]) {
      const data = await (await page.request.get(`/api/admin/analytics?days=${days}`)).json();
      expect(data.days).toBe(days);
      expect(data.revenueByDay).toHaveLength(days);
      expect(data.ordersByHour).toHaveLength(24);
    }
  });
});

test("owner-only admin APIs reject anonymous callers", async ({ request }) => {
  for (const path of ["/api/admin/coupons", "/api/admin/customers", "/api/admin/reviews", "/api/admin/categories"]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(403);
  }
  expect((await request.patch("/api/admin/settings", { data: { deliveryFee: 0 } })).status()).toBe(401);
});
