import { defineConfig, devices } from "@playwright/test";
import { readFileSync, existsSync } from "fs";

// The Next.js dev server loads .env itself, but this test runner is a
// separate process — load it here too so tests can use ADMIN_USERNAME/
// ADMIN_PASSWORD without hardcoding credentials in a committed file.
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

// E2E_PORT lets the suite run beside another local dev server that already owns :3000.
const PORT = Number(process.env.E2E_PORT || 3000);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  // Production serves each request via its own isolated serverless function;
  // locally everything shares one `next dev` process + a single remote DB
  // connection, so too much worker concurrency here causes contention that
  // doesn't reflect real behavior — cap it for stable local runs.
  workers: 2,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: BASE_URL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["iPhone SE"] },
      testMatch: /mobile-.*\.spec\.ts/,
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /(storefront|admin)\.spec\.ts/,
    },
    {
      // Chromium at a phone viewport rather than real WebKit — see
      // admin-mobile.spec.ts for why the login-dependent mobile admin test
      // can't run under WebKit reliably.
      name: "mobile-admin",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 667 } },
      testMatch: /admin-mobile\.spec\.ts/,
    },
  ],
});
