import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

// Unit ("function") tests: pure logic, no browser, no database. Run with `npm run test:unit`.
// End-to-end browser tests live next to them in tests/*.spec.ts and run with Playwright.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
