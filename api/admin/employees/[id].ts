// ==========================================
// /api/admin/employees/[id]
// ==========================================
// GET: Get employee details
// PUT: Update employee

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, sendSuccess, sendError, NotFoundError } from '../../_lib/helpers.js';
import { authAdmin } from '../../_lib/auth.js';
import { logAudit } from '../../_lib/audit.js';
import { getDb } from '@crm/firebase-config';
import { COLLECTIONS, AUDIT_ACTIONS, employeeUpdateSchema } from '@crm/shared';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    const admin = await authAdmin(req);
    const employeeId = req.query.id as string;
    if (!employeeId) throw new NotFoundError('Employee ID required');

    switch (req.method) {
      case 'GET':
        return await getEmployee(res, employeeId);
      case 'PUT':
        return await updateEmployee(req, res, admin, employeeId);
      default:
        return sendError(res, { statusCode: 405, message: 'Method not allowed' });
    }
  } catch (error) {
    return sendError(res, error);
  }
}

async function getEmployee(res: VercelResponse, employeeId: string) {
  const db = getDb();
  const doc = await db.collection(COLLECTIONS.EMPLOYEES).doc(employeeId).get();

  if (!doc.exists) throw new NotFoundError('Сотрудник не найден');

  return sendSuccess(res, { employee: { id: doc.id, ...doc.data() } });
}

async function updateEmployee(
  req: VercelRequest,
  res: VercelResponse,
  admin: { uid: string; email: string },
  employeeId: string
) {
  const input = employeeUpdateSchema.parse(req.body);
  const db = getDb();

  const doc = await db.collection(COLLECTIONS.EMPLOYEES).doc(employeeId).get();
  if (!doc.exists) throw new NotFoundError('Сотрудник не найден');

  const oldData = doc.data()!;

  // Build changes for audit
  const changes = Object.entries(input)
    .filter(([key, value]) => JSON.stringify(oldData[key]) !== JSON.stringify(value))
    .map(([key, value]) => ({
      field: key,
      old_value: oldData[key],
      new_value: value,
    }));

  if (changes.length === 0) {
    return sendSuccess(res, { employee: { id: doc.id, ...oldData } });
  }

  // Check for telegram_id uniqueness
  if (input.telegram_id && input.telegram_id !== oldData.telegram_id) {
    const existing = await db
      .collection(COLLECTIONS.EMPLOYEES)
      .where('telegram_id', '==', input.telegram_id)
      .limit(1)
      .get();

    if (!existing.empty && existing.docs[0].id !== employeeId) {
      return sendError(res, {
        statusCode: 409,
        message: `Telegram ID ${input.telegram_id} уже привязан к другому сотруднику`,
      });
    }
  }

  await db.collection(COLLECTIONS.EMPLOYEES).doc(employeeId).update({
    ...input,
    updated_at: FieldValue.serverTimestamp(),
  });

  // Audit log
  await logAudit({
    actorType: 'admin',
    actorId: admin.uid,
    actorEmail: admin.email,
    action: AUDIT_ACTIONS.UPDATE_EMPLOYEE,
    entityType: 'employee',
    entityId: employeeId,
    changes,
  });

  const updatedDoc = await db.collection(COLLECTIONS.EMPLOYEES).doc(employeeId).get();
  return sendSuccess(res, { employee: { id: updatedDoc.id, ...updatedDoc.data() } });
}
