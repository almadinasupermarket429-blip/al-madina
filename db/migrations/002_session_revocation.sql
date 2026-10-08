-- Sessions issued before a password change/reset stop working: a session
-- token's iat must be at or after users.password_changed_at.
alter table users add column if not exists password_changed_at timestamptz;
