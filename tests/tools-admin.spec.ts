// The advanced admin tools: spreadsheet export/import, bulk actions, activity log,
// customer GDPR requests and order export.
import { test, expect, type Page } from "@playwright/test";
import { createTestCustomer } from "./helpers/test-customer";
import { parseCsv, toCsv } from "../lib/csv";

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

test.describe("admin tools", () => {
  test.beforeEach(async ({ page }) => loginAsOwner(page));

  test("product spreadsheet: export, preview an edited price, apply, then restore", async ({ page }) => {
    const res = await page.request.get("/api/admin/products/export");
    expect(res.ok()).toBeTruthy();
    expect(res.headers()["content-type"]).toContain("text/csv");
    const rows = parseCsv(await res.text());
    expect(rows[0]).toEqual(["variant_id", "produkt", "groesse", "kategorie", "preis", "vorher_preis", "bestand", "sichtbar"]);
    expect(rows.length).toBeGreaterThan(100);

    const [header, first] = rows;
    const original = first[4];
    const edited = [header, [...first.slice(0, 4), "123,45", ...first.slice(5)]];

    const preview = await (await page.request.post("/api/admin/products/import", { data: { csv: toCsv(edited), apply: false } })).json();
    expect(preview.preview).toBe(true);
    expect(preview.errors).toEqual([]);
    expect(preview.changes).toHaveLength(1);
    expect(preview.changes[0].price[1]).toBe(123.45);

    try {
      const applied = await (await page.request.post("/api/admin/products/import", { data: { csv: toCsv(edited), apply: true } })).json();
      expect(applied.preview).toBe(false);
      const products: { sizes: { id: string; price: number }[] }[] = await (await page.request.get("/api/products")).json();
      expect(products.flatMap((p) => p.sizes).find((s) => s.id === first[0])?.price).toBe(123.45);
    } finally {
      await page.request.post("/api/admin/products/import", { data: { csv: toCsv([header, first]), apply: true } });
    }
    const restored: { sizes: { id: string; price: number }[] }[] = await (await page.request.get("/api/products")).json();
    expect(restored.flatMap((p) => p.sizes).find((s) => s.id === first[0])?.price.toFixed(2).replace(".", ",")).toBe(original);
  });

  test("import rejects bad rows instead of guessing", async ({ page }) => {
    const csv = toCsv([
      ["variant_id", "preis", "bestand"],
      ["00000000-0000-0000-0000-000000000000", "1,00", "1"],
    ]);
    const result = await (await page.request.post("/api/admin/products/import", { data: { csv, apply: true } })).json();
    expect(result.preview).toBe(true);
    expect(result.errors[0]).toContain("unbekannte variant_id");
  });

  test("bulk hide/show and the activity log records it", async ({ page }) => {
    const products: { id: string; name: string; active: boolean }[] = await (await page.request.get("/api/products")).json();
    const target = products.find((p) => p.active)!;
    const hide = await page.request.post("/api/admin/products/bulk", { data: { ids: [target.id], action: "hide" } });
    expect(hide.ok()).toBeTruthy();
    try {
      const afterHide: { id: string; active: boolean }[] = await (await page.request.get("/api/products")).json();
      expect(afterHide.find((p) => p.id === target.id)?.active).toBe(false);
    } finally {
      await page.request.post("/api/admin/products/bulk", { data: { ids: [target.id], action: "show" } });
    }
    const log = await (await page.request.get("/api/admin/activity?entity=product")).json();
    expect(log.entries.some((e: { action: string }) => e.action === "product.bulk.hide")).toBe(true);

    await page.goto("/admin/activity");
    await expect(page.getByText("1 Produkte ausgeblendet").first()).toBeVisible();
  });

  test("bulk price change rejects nonsense percentages", async ({ page }) => {
    const products: { id: string }[] = await (await page.request.get("/api/products")).json();
    const res = await page.request.post("/api/admin/products/bulk", { data: { ids: [products[0].id], action: "price_percent", value: -95 } });
    expect(res.status()).toBe(400);
  });

  test("customer GDPR: export the data, then erase it", async ({ page, browser, baseURL }) => {
    const shopper = await browser.newContext({ baseURL });
    const customer = await createTestCustomer(shopper.request, "Gdpr Tester");
    try {
      const list: { id: string; email: string }[] = await (await page.request.get(`/api/admin/customers?q=${encodeURIComponent(customer.email)}`)).json();
      const id = list.find((c) => c.email === customer.email)!.id;

      const exported = await (await page.request.get(`/api/admin/customers/${id}`)).json();
      expect(exported.account.email).toBe(customer.email);
      expect(Array.isArray(exported.orders)).toBe(true);

      const erase = await page.request.delete(`/api/admin/customers/${id}`);
      expect(erase.ok()).toBeTruthy();
      expect((await page.request.get(`/api/admin/customers/${id}`)).status()).toBe(404);
    } finally {
      await customer.remove();
      await shopper.close();
    }
  });

  test("orders export downloads a CSV for a date range", async ({ page }) => {
    const res = await page.request.get("/api/admin/orders/export?from=2020-01-01&to=2030-12-31");
    expect(res.ok()).toBeTruthy();
    expect(parseCsv(await res.text())[0][0]).toBe("bestellnummer");
  });

  test("new admin endpoints refuse visitors who aren't logged in", async ({ browser, baseURL }) => {
    const anon = await browser.newContext({ baseURL });
    for (const [method, url] of [
      ["GET", "/api/admin/products/export"],
      ["POST", "/api/admin/products/import"],
      ["POST", "/api/admin/products/bulk"],
      ["GET", "/api/admin/activity"],
      ["GET", "/api/admin/orders/export"],
      ["POST", "/api/admin/upload"],
    ] as const) {
      const res = await anon.request.fetch(url, { method, data: method === "POST" ? {} : undefined });
      expect(res.status(), `${method} ${url}`).toBe(403);
    }
    await anon.close();
  });

  test("products page: search, select and the bulk toolbar appear", async ({ page }) => {
    await page.goto("/admin/products");
    await page.getByLabel("Produkte suchen").fill("Durra Indischer Basmati");
    const row = page.getByText("Durra Indischer Basmati-Reis Sella XXL 4,5 kg");
    await expect(row).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("Durra Indischer Basmati-Reis Sella XXL 4,5 kg auswählen").check();
    await expect(page.getByRole("toolbar", { name: "Mehrfachaktionen" })).toContainText("1 ausgewählt");
  });
});
