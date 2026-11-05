-- Accounts created with "Continue with Google" before migration 008 got has_password = true by default,
-- so "Delete account" would ask them for a password they never had. They are recognisable: Google
-- creates the account already verified in the same statement (email_verified_at = created_at), while
-- normal sign-ups are verified later by code. Staff added by the owner are also created verified but
-- have a real password, so admin_users rows are excluded, as is anyone who has changed their password
-- since. Safe to run again.
update users u
set has_password = false
where u.has_password
  and u.email_verified_at = u.created_at
  and (u.password_changed_at is null or u.password_changed_at = u.created_at)
  and not exists (select 1 from admin_users a where a.user_id = u.id);
