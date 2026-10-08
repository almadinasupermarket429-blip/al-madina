import { test, expect } from "@playwright/test";

// Runs under a Chromium-based mobile viewport rather than real WebKit
// (see the "mobile-admin" project) because real WebKit's built-in password
// autofill/keychain persists a saved credential for this origin across
// browser launches and keeps re-injecting it over whatever the test sets,
// making any login-dependent test unreliable there. The CSS bug this test
// guards against (flex-wrap stacking the status tabs on a second row) is a
// plain width-based media query, so it renders identically under Chromium.

test("admin orders status tabs scroll horizontally instead of wrapping", async ({ page }) => {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  test.skip(!username || !password, "ADMIN_USERNAME/ADMIN_PASSWORD not set in .env");

  await page.goto("/admin/login");
  await page.locator("form input").nth(0).fill(username!);
  await page.locator('input[type="password"]').fill(password!);
  await page.locator("form button").click();
  await page.waitForURL(/\/admin$/);

  const tabRow = page.locator(".overflow-x-auto").first();
  await expect(tabRow).toBeVisible();

  // All 7 status tab buttons (Active, New, Packed, Out for delivery, Completed, Cancelled, All) must exist and stay on one line (no wrap) — the bug
  // from the screenshot was flex-wrap pushing them onto a second row.
  const buttons = tabRow.locator("button");
  await expect(buttons).toHaveCount(7);
  const boxes = await buttons.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
  const uniqueTops = new Set(boxes.map((t) => Math.round(t)));
  expect(uniqueTops.size).toBe(1);
});
