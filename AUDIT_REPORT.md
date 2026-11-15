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

## Important: the live site is switched off

`https://al-madina.vercel.app` answers **402 Payment required / DEPLOYMENT_DISABLED**: Vercel has disabled the deployment, usually because of the plan, billing or usage limits on the account that owns it. The shop is offline until that is resolved in that Vercel account's billing settings. The code itself is fine.

## Not run, and why

- **Live browser check:** the deployment is disabled (see above).
- **Playwright e2e:** needs a test database. `.env` holds the live Neon database, and running the suite there would create orders.

## Optional

- Next.js 15.5 still gets security fixes; upgrading to 16 isn't urgent.
