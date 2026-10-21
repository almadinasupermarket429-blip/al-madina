import { Prisma } from "@prisma/client";
import { redactFinishedOrders } from "./account-data";
import { prisma } from "./prisma";
import { rateLimit } from "./rate-limit";

/**
 * Deletes personal data the shop no longer needs (GDPR storage limitation, Art. 5(1)(e)).
 * Called after busy requests (login, sign-up, orders); the rate limiter makes sure the
 * actual work runs at most once every 6 hours across all server instances.
 *
 * Retention rules (keep in sync with the privacy policy, section "Speicherdauer"):
 * - Sign-ups never confirmed by email: 7 days.
 * - Guest shopping carts: 90 days after last change (same as the cart cookie).
 * - Empty guest carts: 1 day.
 * - Expired or used email codes and password-reset links: removed.
 * - Contact details on orders (email, phone, notes; name and address on receipts up to
 *   €250): 90 days after the order is delivered or cancelled.
 * - Orders: 8 years (German tax law, § 147 AO, § 257 HGB, since 2025), then deleted.
 * - Deleted accounts: the anonymous placeholder goes once none of its orders remain.
 * - Admin activity log: 2 years.
 */
export async function runCleanupIfDue(): Promise<void> {
  const { allowed } = await rateLimit("maintenance:data-cleanup", 1, 6 * 60 * 60 * 1000);
  if (!allowed) return;
  try {
    await prisma.$transaction([
      prisma.$executeRaw`
        delete from users u
        where u.email_verified_at is null and u.deleted_at is null
          and u.created_at < now() - interval '7 days'
          and not exists (select 1 from orders o where o.user_id = u.id)
          and not exists (select 1 from admin_users a where a.user_id = u.id)
      `,
      prisma.$executeRaw`delete from carts where guest_token is not null and updated_at < now() - interval '90 days'`,
      prisma.$executeRaw`
        delete from carts c where c.guest_token is not null and c.updated_at < now() - interval '1 day'
          and not exists (select 1 from cart_items i where i.cart_id = c.id)
      `,
      prisma.$executeRaw`delete from email_verifications where expires_at < now()`,
      prisma.$executeRaw`delete from password_resets where expires_at < now() or used_at is not null`,
      redactFinishedOrders(Prisma.sql`updated_at < now() - interval '90 days'`),
      prisma.$executeRaw`delete from orders where created_at < now() - interval '8 years'`,
      prisma.$executeRaw`delete from admin_audit_log where created_at < now() - interval '2 years'`,
      prisma.$executeRaw`
        delete from users u
        where u.deleted_at is not null
          and not exists (select 1 from orders o where o.user_id = u.id)
      `,
    ]);
  } catch (err) {
    console.error("[cleanup] data cleanup failed", err);
  }
}
