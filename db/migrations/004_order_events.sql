-- Live admin notifications (lib/events.ts). Each "new order" / "order updated"
-- event is written here and every server instance polls the table, so an
-- admin tab gets the event no matter which instance handled the order.
-- Rows are only needed for a few seconds; old ones are swept automatically.
create table if not exists order_events (
  id         bigserial primary key,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_order_events_created on order_events(created_at);
