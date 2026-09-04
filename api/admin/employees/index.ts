// ==========================================
// /api/admin/employees
// ==========================================
// GET: List all employees
// POST: Create new employee

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, sendSuccess, sendError } from '../../_lib/helpers.js';
import { authAdmin } from '../../_lib/auth.js';
import { logAudit } from '../../_lib/audit.js';
import { getDb } from '@crm/firebase-config';
import { COLLECTIONS, AUDIT_ACTIONS, employeeCreateSchema } from '@crm/shared';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    const admin = await authAdmin(req);

    switch (req.method) {
      case 'GET':
        return await listEmployees(res);
      case 'POST':
        return await createEmployee(req, res, admin);
      default:
        return sendError(res, { statusCode: 405, message: 'Method not allowed' });
    }
  } catch (error) {
    return sendError(res, error);
  }
}

async function listEmployees(res: VercelResponse) {
  const db = getDb();
  const snapshot = await db.collection(COLLECTIONS.EMPLOYEES).orderBy('name').get();

  const employees = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return sendSuccess(res, { employees });
}

async function createEmployee(
  req: VercelRequest,
  res: VercelResponse,
  admin: { uid: string; email: string }
) {
  const input = employeeCreateSchema.parse(req.body);
  const db = getDb();

  // If telegram_id is provided, check for duplicates
  if (input.telegram_id) {
    const existing = await db
      .collection(COLLECTIONS.EMPLOYEES)
      .where('telegram_id', '==', input.telegram_id)
      .limit(1)
      .get();

    if (!existing.empty) {
      return sendError(res, {
        statusCode: 409,
        message: `Telegram ID ${input.telegram_id} уже привязан к другому сотруднику`,
      });
    }
  }

  const employeeData = {
    ...input,
    status: input.telegram_id ? 'active' : 'pending_link',
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };

  const docRef = await db.collection(COLLECTIONS.EMPLOYEES).add(employeeData);

  // Audit log
  await logAudit({
    actorType: 'admin',
    actorId: admin.uid,
    actorEmail: admin.email,
    action: AUDIT_ACTIONS.CREATE_EMPLOYEE,
    entityType: 'employee',
    entityId: docRef.id,
    changes: [{ field: 'created', old_value: null, new_value: input }],
  });

  return sendSuccess(res, {
    employee: { id: docRef.id, ...employeeData },
  }, 201);
}
