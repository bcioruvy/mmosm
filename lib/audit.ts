import sql from "@/lib/db";

export async function logAudit(params: {
  actorId: string | number;
  action: string;
  entityType: string;
  entityId: string | number;
  details?: Record<string, unknown>;
}) {
  const { actorId, action, entityType, entityId, details } = params;
  await sql`
    INSERT INTO audit_log (actor_id, action, entity_type, entity_id, details)
    VALUES (${actorId}, ${action}, ${entityType}, ${String(entityId)}, ${sql.json((details ?? {}) as any)})
  `;
}
