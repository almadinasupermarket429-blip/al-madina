-- Order lifecycle: language for emails, bottle deposit on orders, and a flag when the
-- order confirmation email could not be sent. Safe to run again.

-- The language a customer uses the shop in; emails go out in it.
alter table users add column if not exists language text not null default 'de';
alter table orders add column if not exists language text not null default 'de';
do $$ begin
  alter table users add constraint chk_users_language check (language in ('de', 'en'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table orders add constraint chk_orders_language check (language in ('de', 'en'));
exception when duplicate_object then null; end $$;

-- False for accounts created with "Continue with Google" (they have a random, unknown password):
-- deleting such an account asks for the email address instead of a password.
alter table users add column if not exists has_password boolean not null default true;

-- Bottle/can deposit (Pfand, PAngV § 7): charged on top of the item price and part of the total.
alter table order_items add column if not exists deposit numeric(10,2) not null default 0;
alter table orders add column if not exists deposit_total numeric(10,2) not null default 0;

-- Set when the order confirmation email failed or SMTP is not set up, so staff can call the customer.
alter table orders add column if not exists confirmation_email_failed boolean not null default false;
