-- =====================================================================
-- 000_base_schema.sql — Al-Madina Markt, Postgres (Neon)
--
-- The core tables exactly as the app queries them (all access is raw SQL
-- via prisma.$queryRaw — prisma/schema.prisma intentionally declares no
-- models). Idempotent: on an existing database every statement is a no-op,
-- on an empty one it builds everything. Later files in db/migrations/ add
-- features on top. Apply all of them with:  npm run db:migrate
--
-- Conventions:
--  * Accounts are mandatory for checkout -> orders.user_id is NOT NULL and
--    ON DELETE RESTRICT; users are soft-deleted via deleted_at.
--  * Admins are regular users with a row in admin_users (role marker).
--  * Order status / fulfillment are plain text with CHECK constraints.
--  * order_items snapshot name/size/price so catalog edits never rewrite history.
-- =====================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()

do $$ begin
  create type admin_role as enum ('OWNER', 'STAFF');
exception when duplicate_object then null; end $$;

do $$ begin
  create type variant_size_unit as enum ('g', 'kg', 'ml', 'l', 'pcs');
exception when duplicate_object then null; end $$;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---- People ------------------------------------------------------------
create table if not exists users (
  id                uuid primary key default gen_random_uuid(),
  email             text not null unique,          -- stored lower-case
  password_hash     text not null,                 -- bcrypt
  full_name         text not null,
  phone             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  email_verified_at timestamptz
);
drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at before update on users
  for each row execute function set_updated_at();

create table if not exists admin_users (
  user_id    uuid primary key references users(id) on delete cascade,
  role       admin_role not null default 'STAFF',
  created_at timestamptz not null default now()
);

create table if not exists email_verifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  code_hash  text not null,                        -- sha256 of the 6-digit code
  expires_at timestamptz not null,
  attempts   int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_email_verifications_user on email_verifications(user_id);

create table if not exists addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  label       text not null default 'Home',
  line1       text not null,
  line2       text,
  city        text not null,
  postal_code text not null,
  latitude    numeric(9,6),
  longitude   numeric(9,6),
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_addresses_user on addresses(user_id);

-- ---- Catalog -----------------------------------------------------------
create table if not exists categories (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid references categories(id) on delete set null,
  name       text not null,
  slug       text not null unique,
  image_url  text,
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_categories_parent on categories(parent_id);

create table if not exists products (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete set null,
  name        text not null,
  slug        text not null unique,
  description text,
  image_url   text,
  badge       text,                 -- e.g. "Neu", "Bestseller"
  unit_note   text,                 -- e.g. "pro kg"
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  legacy_id   text unique
);
create index if not exists idx_products_category on products(category_id);
drop trigger if exists trg_products_updated_at on products;
create trigger trg_products_updated_at before update on products
  for each row execute function set_updated_at();

create table if not exists product_variants (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid not null references products(id) on delete cascade,
  sku                 text not null unique,
  size_label          text not null,
  size_value          numeric(10,3),
  size_unit           variant_size_unit,
  price               numeric(10,2) not null,
  compare_at_price    numeric(10,2),        -- "was" price, shows as a sale
  stock_quantity      int not null default 0,
  low_stock_threshold int not null default 5,
  sort_order          int not null default 0,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  legacy_id           text unique,
  constraint chk_variant_price_nonneg check (price >= 0),
  constraint chk_variant_stock_nonneg check (stock_quantity >= 0)
);
create index if not exists idx_variants_product on product_variants(product_id);
drop trigger if exists trg_variants_updated_at on product_variants;
create trigger trg_variants_updated_at before update on product_variants
  for each row execute function set_updated_at();

-- ---- Engagement --------------------------------------------------------
create table if not exists wishlists (
  user_id    uuid not null references users(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table if not exists reviews (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  rating     int not null check (rating between 1 and 5),
  title      text,
  comment    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, user_id)
);
drop trigger if exists trg_reviews_updated_at on reviews;
create trigger trg_reviews_updated_at before update on reviews
  for each row execute function set_updated_at();

-- ---- Operations --------------------------------------------------------
create table if not exists delivery_slots (
  id         uuid primary key default gen_random_uuid(),
  slot_date  date not null,
  start_time time not null,
  end_time   time not null,
  capacity   int not null default 20,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  constraint chk_slot_time_order check (end_time > start_time),
  unique (slot_date, start_time, end_time)
);
create index if not exists idx_delivery_slots_date on delivery_slots(slot_date);

-- Owner-editable key/value settings (see lib/settings.ts for the keys).
create table if not exists store_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);
drop trigger if exists trg_settings_updated_at on store_settings;
create trigger trg_settings_updated_at before update on store_settings
  for each row execute function set_updated_at();

-- Distance x subtotal fee matrix used by lib/pricing.ts. Not wired into
-- checkout (which needs geocoded addresses); fees come from store_settings.
create table if not exists delivery_fee_rules (
  id              uuid primary key default gen_random_uuid(),
  min_distance_km numeric(6,2) not null default 0,
  max_distance_km numeric(6,2),
  min_subtotal    numeric(10,2) not null default 0,
  max_subtotal    numeric(10,2),
  fee             numeric(10,2) not null,
  priority        int not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  constraint chk_distance_range check (max_distance_km is null or max_distance_km > min_distance_km),
  constraint chk_subtotal_range check (max_subtotal is null or max_subtotal > min_subtotal)
);
create index if not exists idx_fee_rules_priority on delivery_fee_rules(priority) where is_active;

-- ---- Cart (account OR anonymous guest token) ---------------------------
create table if not exists carts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references users(id) on delete cascade,
  guest_token text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint chk_cart_owner check ((user_id is not null)::int + (guest_token is not null)::int = 1)
);
drop trigger if exists trg_carts_updated_at on carts;
create trigger trg_carts_updated_at before update on carts
  for each row execute function set_updated_at();

create table if not exists cart_items (
  id         uuid primary key default gen_random_uuid(),
  cart_id    uuid not null references carts(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete cascade,
  quantity   int not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);
create index if not exists idx_cart_items_cart on cart_items(cart_id);

-- ---- Orders ------------------------------------------------------------
create table if not exists orders (
  id                   uuid primary key default gen_random_uuid(),
  order_number         text not null unique,       -- AM-YYYYMMDD-XXXXXX
  user_id              uuid not null references users(id) on delete restrict,
  customer_name        text not null,
  customer_email       text not null,
  customer_phone       text not null,
  fulfillment          text not null default 'DELIVERY',
  delivery_address_id  uuid references addresses(id) on delete set null,
  address              text,                       -- frozen copy
  delivery_distance_km numeric(6,2),
  delivery_slot_id     uuid references delivery_slots(id) on delete set null,
  notes                text,
  subtotal             numeric(10,2) not null,
  delivery_fee         numeric(10,2) not null default 0,
  total                numeric(10,2) not null,
  status               text not null default 'PLACED',
  delivery_token       text not null unique,       -- secret for the /deliver/[token] link
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint chk_fulfillment_values check (fulfillment in ('DELIVERY', 'PICKUP')),
  constraint chk_order_status_values check (status in ('PLACED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED'))
);
create index if not exists idx_orders_user on orders(user_id);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_slot on orders(delivery_slot_id);
drop trigger if exists trg_orders_updated_at on orders;
create trigger trg_orders_updated_at before update on orders
  for each row execute function set_updated_at();

create table if not exists order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  variant_id uuid references product_variants(id) on delete set null,
  name       text not null,
  size_label text,
  price      numeric(10,2) not null,
  qty        int not null,
  constraint order_items_quantity_check check (qty > 0)
);
create index if not exists idx_order_items_order on order_items(order_id);

create table if not exists order_status_history (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  status     text not null,
  changed_by uuid,
  created_at timestamptz not null default now(),
  constraint chk_status_history_values check (status in ('PLACED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED'))
);
create index if not exists idx_status_history_order on order_status_history(order_id);
