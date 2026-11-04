import { expect, test } from "@playwright/test";
import { createTestCustomer } from "./helpers/test-customer";
// A seeded product that is always in stock (same as STABLE_PRODUCT_TEXT in storefront.spec.ts).
const STABLE_PRODUCT_TEXT = "Basmatireis";

// The shop's main job, end to end: basket -> checkout -> order placed -> basket empty.
// The order is cancelled afterwards, which puts the stock back.
test("a logged-in customer can order for pickup and pay in cash", async ({ page }) => {
  test.setTimeout(90_000);
  const customer = await createTestCustomer(page.request, "Playwright Besteller");
  try {
    await page.goto("/");
    await page.waitForSelector(".product-grid .product-card");
    await page.locator(".product-grid").first().locator(".product-card", { hasText: STABLE_PRODUCT_TEXT }).locator(".add-btn").click();
    await expect(page.locator(".cart-btn i")).toHaveText("1", { timeout: 15_000 });

    await page.locator(".cart-btn").click();
    await page.locator(".cart-drawer").getByRole("button", { name: /Zur Kasse/ }).click();

    const checkout = page.getByRole("dialog", { name: "Kasse" });
    await expect(checkout).toBeVisible();
    await checkout.getByRole("button", { name: /Abholung im Laden/ }).click();
    await checkout.getByLabel("Telefonnummer").fill("01520 1234567");

    // The order overview right above the button lists the item and says prices include VAT.
    await expect(checkout.getByRole("list", { name: "Ihre Artikel" })).toContainText(STABLE_PRODUCT_TEXT);
    await expect(checkout).toContainText("inkl. MwSt.");

    await checkout.getByRole("button", { name: /Zahlungspflichtig bestellen/ }).click();

    const done = page.getByRole("dialog", { name: "Bestellung aufgegeben" });
    await expect(done).toBeVisible({ timeout: 20_000 });
    await expect(done).toContainText(/#AM-\d{8}-[0-9A-F]{6}/);
    // The basket empties as soon as the order is placed.
    await expect(page.locator(".cart-btn i")).toHaveText("0");

    const orders: { id: string; status: string; fulfillment: string }[] = await (await page.request.get("/api/account/orders")).json();
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ status: "PLACED", fulfillment: "PICKUP" });
    expect((await page.request.delete(`/api/account/orders/${orders[0].id}`)).ok()).toBeTruthy();
  } finally {
    await customer.remove();
  }
});
