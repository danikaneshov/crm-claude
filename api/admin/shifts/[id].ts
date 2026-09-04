// ==========================================
// /api/admin/shifts/[id]
// ==========================================
// GET: Get shift details
// PUT: Correct shift results (admin override)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, sendSuccess, sendError, NotFoundError, BadRequestError } from '../../_lib/helpers.js';
import { authAdmin } from '../../_lib/auth.js';
import { logAudit, logShiftChange } from '../../_lib/audit.js';
import { getDb } from '@crm/firebase-config';
import {
  COLLECTIONS,
  AUDIT_ACTIONS,
  SHIFT_STATUS,
  shiftCorrectSchema,
  calculateShiftResults,
} from '@crm/shared';
import type { Shift } from '@crm/shared';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    const admin = await authAdmin(req);
    const shiftId = req.query.id as string;
    if (!shiftId) throw new NotFoundError('Shift ID required');

    switch (req.method) {
      case 'GET':
        return await getShiftDetails(res, shiftId);
      case 'PUT':
        return await correctShift(req, res, admin, shiftId);
      default:
        return sendError(res, { statusCode: 405, message: 'Method not allowed' });
    }
  } catch (error) {
    return sendError(res, error);
  }
}

async function getShiftDetails(res: VercelResponse, shiftId: string) {
  const db = getDb();
  const doc = await db.collection(COLLECTIONS.SHIFTS).doc(shiftId).get();
  if (!doc.exists) throw new NotFoundError('Смена не найдена');

  const data = doc.data()!;

  // Get names
  const [firstMaster, secondMaster, location] = await Promise.all([
    db.collection(COLLECTIONS.EMPLOYEES).doc(data.first_master_id).get(),
    data.second_master_id ? db.collection(COLLECTIONS.EMPLOYEES).doc(data.second_master_id).get() : null,
    db.collection(COLLECTIONS.LOCATIONS).doc(data.location_id).get(),
  ]);

  // Get change history
  const changesSnap = await db
    .collection(COLLECTIONS.SHIFT_CHANGES)
    .where('shift_id', '==', shiftId)
    .orderBy('created_at', 'desc')
    .get();

  const changes = changesSnap.docs.map((c) => ({ id: c.id, ...c.data() }));

  return sendSuccess(res, {
    shift: {
      id: doc.id,
      ...data,
      first_master_name: firstMaster.exists ? firstMaster.data()!.name : 'Unknown',
      second_master_name: secondMaster?.exists ? secondMaster.data()!.name : null,
      location_name: location.exists ? location.data()!.name : 'Unknown',
    },
    changes,
  });
}

async function correctShift(
  req: VercelRequest,
  res: VercelResponse,
  admin: { uid: string; email: string },
  shiftId: string
) {
  const input = shiftCorrectSchema.parse(req.body);
  const db = getDb();

  const doc = await db.collection(COLLECTIONS.SHIFTS).doc(shiftId).get();
  if (!doc.exists) throw new NotFoundError('Смена не найдена');

  const shift = { id: doc.id, ...doc.data() } as Shift;

  // Allow correction on CLOSED, CORRECTED, or ERROR shifts
  if (shift.status === SHIFT_STATUS.OPEN || shift.status === SHIFT_STATUS.PROCESSING) {
    throw new BadRequestError('Нельзя исправить смену в статусе ' + shift.status);
  }

  // Log changes
  if (shift.final_hookahs !== input.final_hookahs) {
    await logShiftChange({
      shiftId,
      adminId: admin.uid,
      adminEmail: admin.email,
      field: 'final_hookahs',
      oldValue: shift.final_hookahs,
      newValue: input.final_hookahs,
    });
  }

  if (shift.final_replacements !== input.final_replacements) {
    await logShiftChange({
      shiftId,
      adminId: admin.uid,
      adminEmail: admin.email,
      field: 'final_replacements',
      oldValue: shift.final_replacements,
      newValue: input.final_replacements,
    });
  }

  // Recalculate
  const hasTwoMasters = shift.second_master_id !== null;
  const locationRules = shift.location_salary_rules_snapshot;

  const results = calculateShiftResults({
    hookahs: input.final_hookahs,
    replacements: input.final_replacements,
    firstMasterSalaryBase: shift.first_master_salary_base_snapshot,
    firstMasterSalaryPerSale: shift.first_master_salary_per_sale_snapshot,
    secondMasterSalaryBase: shift.second_master_salary_base_snapshot,
    secondMasterSalaryPerSale: shift.second_master_salary_per_sale_snapshot,
    hasTwoMasters,
    locationRules,
  });

  // Update shift
  await db.collection(COLLECTIONS.SHIFTS).doc(shiftId).update({
    final_hookahs: input.final_hookahs,
    final_replacements: input.final_replacements,
    total_sales: results.totalSales,
    first_master_sales: results.firstMasterSales,
    second_master_sales: results.secondMasterSales,
    first_master_salary: results.firstMasterSalary,
    second_master_salary: results.secondMasterSalary,
    status: SHIFT_STATUS.CORRECTED,
    updated_at: FieldValue.serverTimestamp(),
  });

  // Audit log
  await logAudit({
    actorType: 'admin',
    actorId: admin.uid,
    actorEmail: admin.email,
    action: AUDIT_ACTIONS.CORRECT_SHIFT,
    entityType: 'shift',
    entityId: shiftId,
    changes: [
      { field: 'final_hookahs', old_value: shift.final_hookahs, new_value: input.final_hookahs },
      { field: 'final_replacements', old_value: shift.final_replacements, new_value: input.final_replacements },
      { field: 'first_master_salary', old_value: shift.first_master_salary, new_value: results.firstMasterSalary },
      { field: 'second_master_salary', old_value: shift.second_master_salary, new_value: results.secondMasterSalary },
    ],
  });

  return sendSuccess(res, {
    shift_id: shiftId,
    status: SHIFT_STATUS.CORRECTED,
    results: {
      total_sales: results.totalSales,
      first_master: {
        sales: results.firstMasterSales,
        salary: results.firstMasterSalary,
      },
      second_master: hasTwoMasters
        ? {
            sales: results.secondMasterSales,
            salary: results.secondMasterSalary,
          }
        : null,
    },
  });
}
