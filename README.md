# Al-Madina Markt — online shop

Online shop and admin portal for **Al-Madina Markt** (سوبر ماركت وملحمة المدينة),
an Arabic/Turkish supermarket and halal butcher at Landwehrstraße 12, 97421 Schweinfurt.

Next.js 15 (App Router) · React 19 · Tailwind CSS 4 · Postgres (Neon) via Prisma raw SQL · Nodemailer.
Payment is **cash only**, on delivery or pickup — there is no payment gateway.

## Features

**Storefront** (German by default, English toggle)
- Catalog with categories, an "Offers" filter, attribute tags (Halal, Vegan, …), search and sorting
- Sale badges (−%), "only N left" / sold-out states, product detail popup and SEO product pages
- Basket for guests and accounts (merged on login), free-delivery progress bar, minimum order
- Checkout: delivery or pickup, bookable time slots, coupon codes, substitution preference, order notes
- Customer accounts: email verification, password reset, profile and password change, saved addresses,
  wishlist, order history with status timeline, reorder, self-service cancellation of new orders
- Order tracking without login (`/track`), delivery-driver confirmation link (`/deliver/[token]`)
- Store details from the Google listing: hours with a live "open now" badge, services, Plus Code, directions
- Impressum, Datenschutz, cookie notice; `robots.txt`, `sitemap.xml`, Product and GroceryStore JSON-LD

**Admin portal** (`/admin`, Owner and Staff roles)
- Orders: live updates with sound, search, date range, status tabs, cancel (restocks automatically),
  staff notes, printable packing slip, CSV export, one switch to pause online orders
- Time slots: generate delivery/pickup windows in bulk, capacity per window, live booking counts
- Products & stock: search/filters (low stock, sold out, on sale, hidden), inline stock +/−, sizes, tags
- Categories (order, visibility, image), coupons (percent / fixed / free delivery, limits, validity),
  customers with lifetime stats, review moderation, team accounts
- Analytics: 7/30/90-day revenue vs previous period, peak hours, weekdays, delivery vs pickup,
  top products, coupon usage, low-stock list
- Settings: delivery fee, free-delivery threshold, minimum order, delivery/pickup on/off, shop banner

## Quick start

```bash
npm install
cp .env.example .env     # fill in DATABASE_URL, JWT_SECRET, admin login, SMTP …
npm run db:migrate       # creates/updates all tables (safe to re-run)
npm run db:seed          # optional: demo catalog, only if the catalog is empty
npm run dev              # http://localhost:3000  ·  admin: /admin
```

Tests (Playwright): `npm run test:e2e` — set `E2E_PORT=3100` if another app already uses port 3000.

See **[SETUP.md](SETUP.md)** for configuration, email, admin accounts and deployment.
