-- Activity log: who changed what in the admin, and when (prices, stock, products,
-- orders, settings, customers). Kept 2 years, then removed by lib/cleanup.ts.
create table if not exists admin_audit_log (
  id         bigserial primary key,
  created_at timestamptz not null default now(),
  actor      text not null,          -- admin email, or the .env fallback username
  action     text not null,          -- e.g. "product.update", "variant.price", "order.status"
  entity     text not null,          -- "product", "variant", "order", "settings", ...
  entity_id  text,
  summary    text not null,          -- human-readable one-liner shown in the admin
  details    jsonb not null default '{}'
);
create index if not exists idx_audit_created on admin_audit_log(created_at desc);
create index if not exists idx_audit_entity on admin_audit_log(entity, entity_id);
