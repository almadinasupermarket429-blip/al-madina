-- =====================================================================
-- 001_store_features.sql
-- Store settings, coupons, delivery slot booking, order cancellation,
-- substitution preferences, product tags and customer password reset.
--
-- Purely additive and idempotent — safe to run more than once:
--   node scripts/migrate.mjs
-- =====================================================================

-- ---- Orders: cancellation, coupons, substitution preference ----------
alter table orders add column if not exists discount numeric(10,2) not null default 0;
alter table orders add column if not exists coupon_code text;
alter table orders add column if not exists substitution text not null default 'CALL';
alter table orders add column if not exists cancel_reason text;
alter table orders add column if not exists internal_note text;

alter table orders drop constraint if exists chk_order_substitution_values;
alter table orders add constraint chk_order_substitution_values
  check (substitution in ('SUBSTITUTE', 'CALL', 'REMOVE'));

alter table orders drop constraint if exists chk_order_status_values;
alter table orders add constraint chk_order_status_values
  check (status in ('PLACED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'));

alter table order_status_history drop constraint if exists chk_status_history_values;
alter table order_status_history add constraint chk_status_history_values
  check (status in ('PLACED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'));

create index if not exists idx_orders_created_at on orders(created_at);
create index if not exists idx_orders_coupon on orders(coupon_code) where coupon_code is not null;

-- ---- Products: dietary / attribute tags (Halal, Vegan, Bio, …) -------
alter table products add column if not exists tags text[] not null default '{}';

-- ---- Coupons -----------------------------------------------------------
create table if not exists coupons (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,          -- stored upper-case
  description        text,
  discount_type      text not null default 'PERCENT',
  discount_value     numeric(10,2) not null,
  min_subtotal       numeric(10,2) not null default 0,
  max_uses           int,                            -- null = unlimited
  once_per_customer  boolean not null default true,
  starts_at          timestamptz,
  expires_at         timestamptz,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint chk_coupon_type check (discount_type in ('PERCENT', 'FIXED', 'FREE_DELIVERY')),
  constraint chk_coupon_value check (discount_value >= 0),
  constraint chk_coupon_percent check (discount_type <> 'PERCENT' or discount_value <= 100)
);
drop trigger if exists trg_coupons_updated_at on coupons;
create trigger trg_coupons_updated_at before update on coupons
  for each row execute function set_updated_at();

-- ---- Customer password reset ------------------------------------------
create table if not exists password_resets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_password_resets_user on password_resets(user_id);
