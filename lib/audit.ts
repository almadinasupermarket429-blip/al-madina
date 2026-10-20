import { prisma } from "./prisma";

type Actor = { username: string } | null;

/**
 * Records an admin action in the activity log. Never throws: a logging failure
 * must not undo or block the change the admin just made.
 */
export async function logAdminAction(
  actor: Actor,
  action: string,
  entity: string,
  entityId: string | null,
  summary: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  try {
    await prisma.$executeRaw`
      insert into admin_audit_log (actor, action, entity, entity_id, summary, details)
      values (${actor?.username ?? "system"}, ${action}, ${entity}, ${entityId}, ${summary.slice(0, 500)}, ${JSON.stringify(details)}::jsonb)
    `;
  } catch (err) {
    console.error("[audit] could not record action", action, err);
  }
}
