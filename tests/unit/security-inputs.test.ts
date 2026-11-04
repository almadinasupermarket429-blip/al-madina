import { describe, expect, it } from "vitest";
import { isValidEmail } from "@/lib/disposable-email";
import { safeNextPath } from "@/lib/google-auth";

describe("safeNextPath (where to go after Google sign-in)", () => {
  it.each(["/account", "/account/orders/abc", "/products/canjeero?x=1"])("keeps same-site path %s", (p) => {
    expect(safeNextPath(p)).toBe(p);
  });
  it.each([
    null,
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "/\r/evil.example",
  ])("sends %j to /account instead of another site", (p) => {
    expect(safeNextPath(p)).toBe("/account");
  });
});

describe("isValidEmail", () => {
  it.each(["amina@example.de", "said.mahamud+shop@mail.example.com"])("accepts %s", (e) => expect(isValidEmail(e)).toBe(true));
  it.each([
    "me@x.com, victim@y.org",
    "me@x.com;victim@y.org",
    "Name <me@x.com>",
    "me @x.com",
    "no-at-sign.de",
    "me@localhost",
    `${"a".repeat(250)}@x.de`,
    42,
    undefined,
  ])("rejects %j", (e) => expect(isValidEmail(e)).toBe(false));
});
