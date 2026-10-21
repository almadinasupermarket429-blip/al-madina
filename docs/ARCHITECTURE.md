# Architecture

How the Al-Madina shop is built and the rules the code follows. Setup and day-to-day use: [README](../README.md) and
[SETUP.md](../SETUP.md).

## The pieces

```
 Customers (browser)                         Staff / owner (browser)
   /  /products/…  /cart  /account  /track     /admin/*  (live order feed over Server-Sent Events)
        │ customer cookie (JWT)                     │ admin cookie (JWT) or customer login with admin_users row
        ▼                                           ▼
 ┌────────────────────── Next.js 15 on Vercel (functions in Frankfurt, fra1) ──────────────────────┐
 │ middleware.ts: per-request CSP nonce, cross-site write block, admin page gate                    │
 │ app/api/*  route handlers   ·   app/*  pages (storefront in app/_store, admin in app/admin)     │
 │ lib/*  database (Prisma raw SQL), auth, cart, orders, coupons, slots, mail, cleanup             │
 └───────────────┬───────────────────────────┬───────────────────────────┬────────────────────────┘
                 ▼                           ▼                           ▼
          Neon Postgres                 SMTP (Nodemailer)          Cloudinary (product photos,
          (Frankfurt)                   order and account emails   served through /img on this site)
```

No payment provider: customers pay cash on delivery or pickup.

## Code layout rules

| Layer | Where | Rule |
| --- | --- | --- |
| Shared pure helpers | `lib/format.ts`, `lib/order-utils.ts`, `lib/settings-shared.ts`, `lib/slug.ts`, `lib/csv.ts` | No I/O; covered by `tests/unit`. |
| Server logic | the rest of `lib/` | All SQL is `prisma.$queryRaw`/`$executeRaw` tagged templates (parameterised). Never use the `…Unsafe` variants. |
| Entry points | `app/api/**/route.ts` | Check the caller first (`getAdminSession` + `isOwner`, or `getCustomerSession`), then call `lib`. |
| Storefront UI | `app/_store/*` (home page), `app/components/*` (shared) | Client components; data from `/api/*`. |

## Who may do what

| Caller | How it's checked |
| --- | --- |
| Owner-only API (products, categories, coupons, customers, team, settings, analytics, reviews, exports, uploads) | `getAdminSession()` and `isOwner()` |
| Staff and owner (orders, live feed, slots) | `getAdminSession()` |
| Owner-only admin pages | also gated in `middleware.ts` from the token's role (the API checks again against the database) |
| Customer API (`/api/account/*`, cart, wishlist, reviews) | `getCustomerSession()`; every query filters by `user_id = session.userId` |
| Delivery driver (`/deliver/[token]`) | long random token printed on the packing slip; expires after delivery; shows no email |
| Order tracking (`/track`) | order number **and** email, rate-limited |

Tokens: both cookies are HS256 JWTs signed with `JWT_SECRET` (at least 32 characters, or the app refuses to start).
Admin tokens carry `typ: "admin"` and customer tokens are refused in the admin cookie (and the reverse). Every
request re-reads the account: deleted accounts, removed admins and tokens issued before a password change stop
working at once.

## Browser security

- `middleware.ts` sets a per-request CSP with a script nonce (no inline scripts without it), `frame-ancestors 'none'`,
  and refuses any write (POST/PUT/PATCH/DELETE) to the API whose `Origin` is another site.
- Cookies are `HttpOnly`, `Secure`, `SameSite=Lax`.
- Product photos load through `/img/…` (a rewrite to Cloudinary in `next.config.ts`), so customers' browsers only talk
  to this site. No analytics or third-party scripts.
- CSV exports (orders, products) write formula-like text (`=`, `+`, `-`, `@`) with a leading apostrophe so Excel
  doesn't run it; the product import removes it again (`lib/csv.ts`).

## Checkout integrity

`POST /api/orders` takes only product variant ids and quantities from the browser. Prices come from the database,
quantities are whole numbers from 1 to 50, and inside one transaction the stock is decremented only if enough is left,
coupon limits are re-checked under a row lock, and slot capacity is re-checked under a row lock. Two customers can't
both buy the last item or the last place in a time slot.

## Live order feed

New and changed orders are written to `order_events`. Each server instance with an open admin tab polls that table
and pushes events over Server-Sent Events (`/api/orders/stream`), so it works across Vercel's many instances.

## Rate limits

`lib/rate-limit.ts` counts in the `rate_limits` table (hashed keys, works across instances). The client IP is the
`x-real-ip` / last `x-forwarded-for` hop set by Vercel, not the spoofable first entry.

## Data lifetime

`lib/cleanup.ts` runs at most every 6 hours, triggered by busy requests (login, sign-up, orders):

| Data | Kept |
| --- | --- |
| Unconfirmed sign-ups | 7 days |
| Empty guest carts | 1 day |
| Guest carts | 90 days after the last change |
| Contact details on finished orders | 90 days (name and address kept on receipts over €250) |
| Orders | 8 years (§ 147 AO, § 257 HGB) |
| Admin activity log | 2 years |
| Expired or used email codes and reset links | removed |

Reading a cart never creates one; a cart row exists only once something is added. Keep `/datenschutz` in step with
this table.

## Environments and tests

- `.env` holds `DATABASE_URL`. If it points at the live database, `npm run dev` and `npm run test:e2e` change live
  data (the admin tests create and delete products). Use a separate Neon branch for development and e2e runs.
- `npm run test:unit` (Vitest, no database), `npm run typecheck`, `npm run lint`, `npm run knip` (unused code).
- `.github/workflows/checks.yml` runs those four on every push.
