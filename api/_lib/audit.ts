// ==========================================
// Audit Logger
// ==========================================

import { getDb } from '@crm/firebase-config';
import { COLLECTIONS } from '@crm/shared';
import type { ActorType, EntityType, AuditChange } from '@crm/shared';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Log an action to the audit_log collection.
 */
export async function logAudit(params: {
  actorType: ActorType;
  actorId: string;
  actorEmail?: string;
  action: string;
  entityType: EntityType;
  entityId: string;
  changes: AuditChange[];
}): Promise<void> {
  const db = getDb();
  await db.collection(COLLECTIONS.AUDIT_LOG).add({
    actor_type: params.actorType,
    actor_id: params.actorId,
    actor_email: params.actorEmail || null,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    changes: params.changes,
    created_at: FieldValue.serverTimestamp(),
  });
}

/**
 * Log a shift change to the shift_changes collection.
 */
export async function logShiftChange(params: {
  shiftId: string;
  adminId: string;
  adminEmail: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
}): Promise<void> {
  const db = getDb();
  await db.collection(COLLECTIONS.SHIFT_CHANGES).add({
    shift_id: params.shiftId,
    admin_id: params.adminId,
    admin_email: params.adminEmail,
    field: params.field,
    old_value: params.oldValue,
    new_value: params.newValue,
    created_at: FieldValue.serverTimestamp(),
  });
}
