import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

/** Why an account can't be deleted right now, or null if it can. */
export async function deletionBlocker(userId: string): Promise<"ADMIN" | "OPEN_ORDERS" | null> {
  const [admin] = await prisma.$queryRaw<{ n: bigint }[]>`select count(*) as n from admin_users where user_id = ${userId}::uuid`;
  if (Number(admin?.n ?? 0) > 0) return "ADMIN";
  const [open] = await prisma.$queryRaw<{ n: bigint }[]>`
    select count(*) as n from orders where user_id = ${userId}::uuid and status not in ('DELIVERED', 'CANCELLED')
  `;
  return Number(open?.n ?? 0) > 0 ? "OPEN_ORDERS" : null;
}

/**
 * GDPR Art. 17: erases the personal data on an account (name, email, phone, password,
 * addresses, wishlist, cart, reviews, pending codes). Past orders are kept, because
 * German tax/commercial law requires business records for 6–10 years (§ 147 AO,
 * § 257 HGB); they stay linked to an anonymous placeholder that can no longer sign in.
 */
export async function anonymizeAccount(userId: string): Promise<void> {
  const unusablePassword = await bcrypt.hash(crypto.randomUUID() + crypto.randomUUID(), 10);
  await prisma.$transaction([
    prisma.$executeRaw`delete from addresses where user_id = ${userId}::uuid`,
    prisma.$executeRaw`delete from wishlists where user_id = ${userId}::uuid`,
    prisma.$executeRaw`delete from reviews where user_id = ${userId}::uuid`,
    prisma.$executeRaw`delete from carts where user_id = ${userId}::uuid`,
    prisma.$executeRaw`delete from email_verifications where user_id = ${userId}::uuid`,
    prisma.$executeRaw`delete from password_resets where user_id = ${userId}::uuid`,
    prisma.$executeRaw`
      update users set
        email = ${`deleted-${userId}@deleted.invalid`},
        full_name = 'Gelöschtes Konto',
        phone = null,
        password_hash = ${unusablePassword},
        password_changed_at = now(),
        email_verified_at = null,
        deleted_at = now()
      where id = ${userId}::uuid
    `,
  ]);
}

/** GDPR Art. 15/20: everything stored about one customer, as plain JSON. */
export async function exportAccountData(userId: string) {
  const [account] = await prisma.$queryRaw<Record<string, unknown>[]>`
    select id, email, full_name as "name", phone, created_at as "createdAt", email_verified_at as "emailVerifiedAt"
    from users where id = ${userId}::uuid and deleted_at is null
  `;
  if (!account) return null;
  const [addresses, orders, reviews, wishlist] = await Promise.all([
    prisma.$queryRaw`select label, line1, line2, city, postal_code as "postalCode", is_default as "isDefault", created_at as "createdAt" from addresses where user_id = ${userId}::uuid`,
    prisma.$queryRaw`
      select o.order_number as "orderNumber", o.created_at as "createdAt", o.status, o.fulfillment, o.customer_name as "name",
             o.customer_email as "email", o.customer_phone as "phone", o.address, o.notes, o.total,
             coalesce(json_agg(json_build_object('name', i.name, 'size', i.size_label, 'price', i.price, 'qty', i.qty)) filter (where i.id is not null), '[]') as items
      from orders o left join order_items i on i.order_id = o.id
      where o.user_id = ${userId}::uuid group by o.id order by o.created_at desc
    `,
    prisma.$queryRaw`select p.name as product, r.rating, r.title, r.comment, r.created_at as "createdAt" from reviews r join products p on p.id = r.product_id where r.user_id = ${userId}::uuid`,
    prisma.$queryRaw`select p.name as product, w.created_at as "addedAt" from wishlists w join products p on p.id = w.product_id where w.user_id = ${userId}::uuid`,
  ]);
  return { exportedAt: new Date().toISOString(), account, addresses, orders, reviews, wishlist };
}
