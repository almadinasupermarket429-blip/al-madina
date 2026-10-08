import { test, expect } from "@playwright/test";

// This file exists because a real user reported (with screenshots) that on
// a phone the navbar overlapped and the page jerked while zooming — both
// were fixed earlier this session. These tests pin that behavior down so a
// future change can't silently reintroduce it.

test("no horizontal overflow on the homepage", async ({ page }) => {
  // networkidle waits for every product image; slow on a cold dev server.
  test.setTimeout(60_000);
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  // A few px of tolerance for scrollbar/rounding — anything beyond that means
  // something is bleeding past the viewport edge (the hero-orb bug from before).
  expect(scrollWidth - clientWidth).toBeLessThanOrEqual(2);
});

test("navbar shows logo + hamburger, not the full desktop nav", async ({ page }) => {
  await page.goto("/");

  const toggle = page.locator(".nav-toggle");
  await expect(toggle).toBeVisible();

  // The desktop-only groups must actually be hidden, not just visually
  // squeezed — this is exactly what broke before (logo wrapped, icons
  // overlapped it) because everything tried to render in one row.
  await expect(page.locator(".nav-links")).toBeHidden();
  await expect(page.locator(".nav-extra")).toBeHidden();

  // The logo must render as one line, not wrap mid-word.
  const logoBox = await page.locator(".header-logo-text b").first().boundingBox();
  expect(logoBox?.height ?? 0).toBeLessThan(30);
});

test("hamburger menu opens, contains search, closes cleanly", async ({ page }) => {
  await page.goto("/");
  await page.locator(".nav-toggle").click();

  const panel = page.locator(".mobile-nav-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Produkte suchen")).toBeVisible();
  await expect(panel.getByText("Shop")).toBeVisible();

  // The close button must stay a small circle, not stretch into a bar —
  // this is the exact CSS-specificity bug found from a user screenshot.
  const closeBtn = panel.locator(".icon-btn");
  const box = await closeBtn.boundingBox();
  expect(box?.width ?? 999).toBeLessThan(60);

  await closeBtn.click();
  await expect(panel).toBeHidden();
});

test("search: opens from hamburger, closes hamburger, filters, and self-closes", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await page.locator(".nav-toggle").click();
  await page.locator(".mobile-nav-panel").getByText("Produkte suchen").click();

  // Hamburger should close the instant search opens.
  await expect(page.locator(".mobile-nav-panel")).toBeHidden();

  const searchInput = page.locator(".mobile-search input");
  await expect(searchInput).toBeVisible();
  await expect(searchInput).toBeFocused();

  // Product catalog data (names/descriptions) is stored in English regardless
  // of UI language — only static chrome text is translated — so search terms
  // here must match actual catalog content, not the German UI strings.
  await searchInput.fill("Coffee");
  // Filtering is live — the grid should narrow to matches as you type.
  await expect(page.locator(".product-grid").first()).toContainText(/Coffee/i);

  await searchInput.press("Enter");
  await expect(page.locator(".mobile-search")).toBeHidden();
});

