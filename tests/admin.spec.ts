import { test, expect } from "@playwright/test";

test.describe("admin", () => {
  test.beforeEach(async ({ page }) => {
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;
    test.skip(!username || !password, "ADMIN_USERNAME/ADMIN_PASSWORD not set in .env");

    await page.goto("/admin/login");
    await page.locator("form input").nth(0).fill(username!);
    await page.locator('input[type="password"]').fill(password!);
    await page.locator("form button").click();
    await page.waitForURL(/\/admin$/);
  });

  test("logs in and shows the orders dashboard", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Bestellungen" })).toBeVisible();
  });

  test("rejects wrong credentials with a clear error, not a crash", async ({ page }) => {
    await page.goto("/admin/login");
    await page.locator("form input").nth(0).fill("wrong-user");
    await page.locator('input[type="password"]').fill("wrong-pass");
    await page.locator("form button").click();
    // bcrypt + a cold dev-server compile can take ~5 s under parallel test load.
    await expect(page.getByText(/ungültig/i)).toBeVisible({ timeout: 15_000 });
  });

  test("products page: create, verify on storefront, then delete", async ({ page, request }) => {
    // Create + storefront check + three cleanup calls, each a cold compile on the dev server.
    test.setTimeout(90_000);
    // A unique name per run means a leftover row from an interrupted previous
    // run can never collide with this run's own strict-mode locator checks.
    const name = `Playwright Test Product ${Date.now()}`;

    await page.goto("/admin/products");
    await page.getByRole("button", { name: /Produkt hinzufügen/i }).click();

    await page.getByPlaceholder("z. B. Reis").fill("Playwright Test Category");
    await page.getByRole("textbox", { name: "Name (Deutsch)" }).fill(name);
    await page.getByPlaceholder("…oder Bild-URL einfügen").fill("/logo.png");
    await page.getByPlaceholder("z. B. 500 g").fill("Test size");
    await page.getByPlaceholder("Preis €").fill("2.50");

    await page.getByRole("button", { name: /Produkt speichern/i }).click();

    try {
      // Creating a product with a new category chains several sequential DB
      // round trips (category lookup/create, slug check, product + variant
      // insert, then a read-back) — give this realistic headroom rather
      // than the tight 5s default.
      await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 10_000 });

      // Confirm it actually reaches the public storefront endpoint, not just the admin list.
      const res = await request.get("/api/products");
      const products: { id: string; name: string }[] = await res.json();
      const created = products.find((p) => p.name === name);
      expect(created).toBeTruthy();
    } finally {
      // Clean up so the test is repeatable and doesn't leave junk data
      // behind, even if an assertion above throws. Guarded: if the product
      // never actually rendered, there's nothing to delete.
      const deleteBtn = page.getByRole("button", { name: new RegExp(`${name} löschen`) });
      if (await deleteBtn.count()) {
        page.on("dialog", (d) => d.accept());
        await deleteBtn.click();
        await expect(deleteBtn).toBeHidden();
        await expect(page.getByRole("status")).toContainText("gelöscht");
      }
      // The UI removes the row optimistically, so make sure the product is really gone
      // server-side before removing the category its save auto-created.
      const all: { id: string; name: string }[] = await (await page.request.get("/api/products")).json();
      for (const p of all.filter((x) => x.name === name)) await page.request.delete(`/api/products/${p.id}`);
      const categories: { id: string; name: string; productCount: number }[] = await (await page.request.get("/api/admin/categories")).json();
      const testCategory = categories.find((c) => c.name === "Playwright Test Category" && c.productCount === 0);
      if (testCategory) await page.request.delete(`/api/admin/categories/${testCategory.id}`);
    }
  });
});
