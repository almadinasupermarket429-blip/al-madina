# Al-Madina Supermarkt – Security, Quality & Performance Audit

**Date:** 2026-11-15 · **Branch:** `main` (= origin/main, 87a231b) · **Repo:** almadinasupermarket429-blip/al-madina · **Stack:** Next.js 15.5.29, React 19, Prisma 6, Neon Postgres, Vercel

Horseed Afro Shop was built from this code, and both received the same audit fixes on 2026-11-04/05. A file-by-file comparison on 2026-11-15 confirmed that Al-Madina has all of Horseed's later security fixes: buyer-only reviews, per-order-number limits on tracking and withdrawals, strict `/img` paths, email links only to the configured site, and admin logout ending the shop session. The remaining differences are branding and shop-specific content. No code was changed in this run.

## Results

| Check | Result |
|---|---|
| `npm audit --omit=dev` | 0 vulnerabilities |
| TypeScript | 0 errors |
| ESLint | 0 issues |
| knip | nothing found |
| Unit tests | 117 passed, 3 skipped (database tests that run only with `TEST_DB=1`) |
| GitHub CI on `main` | green (last run 2026-11-05) |
| Security review | Same results as Horseed: every admin route guarded, customer data limited to the signed-in account, server-side prices and stock, rate limits, no default admin password (see `horseed-afro-shop/AUDIT_REPORT.md`) |

## Correction: the live site is online

The shop's real address is **al-madina-delta.vercel.app** (200, health `ok`). `al-madina.vercel.app`, checked first, belongs to someone else.

## Fixed 2026-11-15: links pointed at localhost (high)

`NEXT_PUBLIC_SITE_URL` on Vercel is `http://localhost:3000`, so the live canonical link, Open Graph URL, JSON-LD, sitemap and **every email button** (password reset, email verification, order status, withdrawal form) pointed at localhost: customers couldn't reset passwords or verify accounts. `lib/site-url.ts` now resolves the public origin in one place; a deployed build ignores a localhost value and uses Vercel's production domain. Tests: `tests/unit/site-url.test.ts` (5). Commit 1a50e69.

**Not live yet:** this project deploys from the Vercel CLI, not from GitHub. Run `vercel deploy --prod` in this folder, and set `NEXT_PUBLIC_SITE_URL` in Vercel to `https://al-madina-delta.vercel.app` (or the shop's own domain).

## Browser suite (Playwright), 2026-11-15

Run against a throwaway local Postgres (PGlite) with the demo seed, email and Cloudinary off: 43 of 55 pass. The other 12 name real products from the live catalog ("Durra Indischer Basmati-Reis Sella XXL", 24+ products per page, 100+ in the spreadsheet), which the 6-product demo seed doesn't have; two are screenshot comparisons. None pointed at a code fault. The GDPR test flagged Unsplash photos, but those come only from the demo seed: the live homepage loads nothing from other servers.

## Optional

- Next.js 15.5 still gets security fixes; upgrading to 16 isn't urgent.
