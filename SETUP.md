# Al-Madina Markt — Setup Guide

Full-stack Next.js shop: storefront, customer accounts, admin portal, Postgres
database and email notifications. Payment is **cash only** (on delivery or
pickup) — there is no payment gateway anywhere in this project.

## 1. Install & configure

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | What it is |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Postgres connection strings. With Neon, `DATABASE_URL` is the *pooled* string and `DIRECT_URL` the direct one; with a single URL, use it for both. |
| `JWT_SECRET` | Random string (≥ 32 chars) that signs login sessions: `openssl rand -base64 48`. The app refuses to start without it. |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Bootstrap **Owner** login for `/admin`. Use it once to create real named accounts on the Team page, and change it before going live — it always works as a fallback. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Outgoing email (see section 4). |
| `STORE_NOTIFICATION_EMAIL` | The shop's inbox — new-order and low-stock alerts go here. |
| `NEXT_PUBLIC_SITE_URL` | Public URL once deployed (e.g. `https://al-madina-markt.de`). Used in email links, the sitemap and structured data. |

## 2. Database

All tables are defined in plain SQL under `db/migrations/` and applied in
order by:

```bash
npm run db:migrate   # safe to re-run: every statement is idempotent
npm run db:seed      # optional demo catalog — only runs if there are no products yet
```

- `000_base_schema.sql` — users, admins, catalog, cart, orders, reviews, slots, settings.
- `001_store_features.sql` — coupons, password resets, order discount/coupon/substitution/
  cancellation columns, product tags, `CANCELLED` status.
- `002_session_revocation.sql` — `users.password_changed_at`: changing or resetting a
  password logs that account out everywhere else.
- `003_rate_limits.sql` — shared rate-limit counters (see section 8).
- `004_order_events.sql` — live admin notifications across server instances.

To change the schema later, add a new numbered file (e.g. `002_….sql`) written
with `if not exists` / `drop … if exists` so it can be re-run, then
`npm run db:migrate`.

> The app queries Postgres with raw SQL (`prisma.$queryRaw`); `prisma/schema.prisma`
> declares no models on purpose. **Never run `prisma db push`** — with no models it
> would try to drop every table.

## 3. Run it

```bash
npm run dev
```

- Shop: http://localhost:3000
- Admin: http://localhost:3000/admin (log in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`)

Tests: `npm run test:e2e` (Playwright starts its own dev server). If another app
already runs on port 3000, use `E2E_PORT=3100 npm run test:e2e` — otherwise the
tests would run against that other app.

## 4. Email

Emails go out over SMTP with Nodemailer (`lib/mailer.ts`). Any provider works:

- **Brevo** or **Resend** (free tiers) — paste their SMTP host/user/password into `.env`.
- **Gmail / Google Workspace** — create an [App Password](https://myaccount.google.com/apppasswords);
  `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`.
- Your web host's mailbox — ask them for the SMTP settings.

Until SMTP is configured nothing breaks: emails are skipped and logged to the
server console instead. In development, verification codes and password-reset
links are printed to the console too.

Emails sent: order confirmation (customer), new-order alert (shop), status
changes incl. "ready for pickup" and cancellation (customer), low-stock alert
(shop), email verification code, password reset link, and "you already have an
account" (when someone signs up with an existing customer's address).

Sign-up is email-first: a new customer enters the 6-digit code from the email
before they're logged in. The sign-up form answers the same way whether or not
the address already has an account, so it can't be used to find out who your
customers are.

## 5. Running the shop day to day

**Settings** (`/admin/settings`, Owner): delivery fee, free-delivery threshold,
minimum order value, delivery and/or pickup on/off, delivery-area note, a shop
banner line, and whether a time slot is required. The **Online orders** switch
at the top of the Orders page pauses checkout instantly (staff can use it too) —
the shop stays browsable and shows your "paused" message.

**Orders** (`/admin`, Owner + Staff): new orders arrive live with an optional
sound. Move them *New → Packed → Out for delivery / ready for pickup*; the
customer is emailed at each step. Each card has:
- **Packing slip** — printable list with tick boxes, slot, substitution preference, cash to collect.
- **Delivery link** — send it to the driver (WhatsApp/SMS); they tap once to confirm handover.
- **Note** — internal, never shown to the customer.
- **Cancel** (New/Packed only) — items go back into stock, the customer is emailed the reason.
Customers can also cancel themselves while an order is still *New*.
Search by order number/name/email/phone, filter by date, export to CSV (opens in Excel).

**Time slots** (`/admin/slots`): generate windows for the next days in one go
(e.g. 10–12, 14–16, 17–19, Sundays skipped), each with a capacity. Full or
switched-off windows aren't offered at checkout. With no slots, checkout simply
skips the time choice.

**Products & stock** (`/admin/products`, Owner): use − / + / *set* on a size to
correct stock after a delivery or breakage without opening the form. A "Was €"
price shows the product as a sale (−%) and puts it under *Offers*. Tags such as
`Halal, Vegan, Bio` become filter chips in the shop. Stock drops automatically
on checkout; at ≤ 5 units the size is flagged and the shop gets an email.

**Categories** (`/admin/categories`): order them (this is the shop's sort
order), hide a whole category, add an image.

**Coupons** (`/admin/coupons`): percent off, fixed € off, or free delivery; with
optional minimum order, total use limit, once-per-customer, and start/end dates.
Uses are counted from real orders (a cancelled order frees its use).

**Customers / Reviews / Analytics**: customer list with order count and spend;
delete inappropriate reviews; revenue, peak hours, weekdays, delivery vs pickup,
top products and coupon usage over 7/30/90 days.

## 6. Admin accounts

Admins are normal user accounts with an Owner or Staff role:

- **Owner** — everything.
- **Staff** — Orders, Time slots (view) and the online-orders switch. All other
  pages and APIs are refused server-side, not just hidden.

Add or remove admins on **Team** (`/admin/team`). If the email already has a
customer account, admin rights are added to it (same login); otherwise a new
account is created. Removing someone only removes the admin role.

The `.env` `ADMIN_USERNAME`/`ADMIN_PASSWORD` login always grants Owner access —
keep it secret and use it as a fallback only.

## 7. Store details

Address, phone, Plus Code, Arabic name, services and opening hours live in one
file: **`lib/store-info.ts`**. The shop page, packing slips, emails and Google
structured data all read from it. Change hours there (e.g. for Ramadan).

**Before going live:** fill in the `[PLATZHALTER]` fields in
`app/impressum/page.tsx` and `app/datenschutz/page.tsx` (legal name/form,
responsible person, public email, VAT ID / register entry if any) and have them
legally reviewed.

## 8. Deploying

Runs on any Node.js host (VPS, Railway, Render) or Vercel. Notes:

- The live "new order" push to the admin dashboard uses Server-Sent Events and
  events stored in Postgres (`order_events` table, `lib/events.ts`). Every
  instance polls that table every 2 seconds while an admin tab is open, so it
  works with any number of instances (no Redis needed).
- Rate limits (login, sign-up, password reset, coupon checks) are stored in
  Postgres (`rate_limits` table), so they hold across any number of instances.
  Login and password changes are also limited per account, so rotating IP
  addresses doesn't help a password guesser.
- On your own server (VPS), run the app behind nginx or Caddy and pass the
  visitor's real IP — the per-IP limits read `X-Real-IP`. Vercel needs nothing.

  nginx:
  ```nginx
  server {
      listen 443 ssl http2;
      server_name al-madina-markt.de;
      # ssl_certificate / ssl_certificate_key from certbot

      location / {
          proxy_pass http://127.0.0.1:3000;
          proxy_set_header Host              $host;
          proxy_set_header X-Real-IP         $remote_addr;   # overwrites anything the client sent
          proxy_set_header X-Forwarded-For   $remote_addr;
          proxy_set_header X-Forwarded-Proto $scheme;
          # Live order feed (Server-Sent Events) on the admin dashboard:
          proxy_buffering off;
          proxy_read_timeout 1h;
      }
  }
  ```
  Caddy does all of this (and HTTPS) with: `al-madina-markt.de { reverse_proxy 127.0.0.1:3000 }`
  — it sets `X-Forwarded-For` itself; add `header_up X-Real-IP {remote_host}` inside
  `reverse_proxy { }`.
- Security headers: a strict Content-Security-Policy with a fresh script nonce
  per request is set in `middleware.ts`; the other headers (HSTS, frame, sniffing)
  in `next.config.ts`. API writes from another website are refused (Origin check).
- Set `NEXT_PUBLIC_SITE_URL` so emails, `sitemap.xml` and `robots.txt` point at
  the real domain.
