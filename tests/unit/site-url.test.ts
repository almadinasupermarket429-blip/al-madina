import { afterEach, describe, expect, it, vi } from "vitest";
import { configuredSiteUrl, siteUrl } from "@/lib/site-url";

afterEach(() => vi.unstubAllEnvs());

function env(values: Record<string, string>) {
  for (const key of ["NEXT_PUBLIC_SITE_URL", "VERCEL_ENV", "VERCEL_PROJECT_PRODUCTION_URL"]) {
    vi.stubEnv(key, values[key] ?? "");
  }
}

describe("site URL", () => {
  it("uses the configured address", () => {
    env({ NEXT_PUBLIC_SITE_URL: "https://shop.example.de/", VERCEL_ENV: "production" });
    expect(siteUrl()).toBe("https://shop.example.de");
  });

  it("ignores a localhost address on a deployed build and uses Vercel's production domain", () => {
    env({
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      VERCEL_ENV: "production",
      VERCEL_PROJECT_PRODUCTION_URL: "al-madina-delta.vercel.app",
    });
    expect(siteUrl()).toBe("https://al-madina-delta.vercel.app");
  });

  it("falls back to Vercel's production domain when nothing is configured", () => {
    env({ VERCEL_ENV: "preview", VERCEL_PROJECT_PRODUCTION_URL: "al-madina-delta.vercel.app" });
    expect(configuredSiteUrl()).toBe("https://al-madina-delta.vercel.app");
  });

  it("keeps localhost on a local machine", () => {
    env({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" });
    expect(siteUrl()).toBe("http://localhost:3000");
  });

  it("has no address for emails when nothing is known", () => {
    env({});
    expect(configuredSiteUrl()).toBeNull();
    expect(siteUrl()).toBe("http://localhost:3000");
  });
});
