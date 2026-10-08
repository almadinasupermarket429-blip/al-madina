-- Shared rate-limit counters (lib/rate-limit.ts). Living in Postgres rather than
-- process memory means the limits hold across several server instances.
-- key is a sha256 hash, so no emails/IPs are stored in plain text.
create table if not exists rate_limits (
  key      text primary key,
  count    integer not null,
  reset_at timestamptz not null
);
create index if not exists idx_rate_limits_reset on rate_limits(reset_at);
