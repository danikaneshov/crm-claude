// ==========================================
// /api/admin/revisions/[id]
// ==========================================
// GET: Get revision details with per-employee breakdown
// PUT: Update revision

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, sendSuccess, sendError, NotFoundError } from '../../_lib/helpers.js';
import { authAdmin } from '../../_lib/auth.js';
import { logAudit } from '../../_lib/audit.js';
import { getDb } from '@crm/firebase-config';
import {
  COLLECTIONS,
  AUDIT_ACTIONS,
  revisionUpdateSchema,
  calculateRevisionDifference,
  calculateEmployeeShifts,
} from '@crm/shared';
import type { Revision, RevisionEmployeeResult } from '@crm/shared';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    const admin = await authAdmin(req);
    const revisionId = req.query.id as string;
    if (!revisionId) throw new NotFoundError('Revision ID required');

    switch (req.method) {
      case 'GET':
        return await getRevisionDetails(res, revisionId);
      case 'PUT':
        return await updateRevision(req, res, admin, revisionId);
      default:
        return sendError(res, { statusCode: 405, message: 'Method not allowed' });
    }
  } catch (error) {
    return sendError(res, error);
  }
}

async function getRevisionDetails(res: VercelResponse, revisionId: string) {
  const db = getDb();
  const doc = await db.collection(COLLECTIONS.REVISIONS).doc(revisionId).get();
  if (!doc.exists) throw new NotFoundError('Ревизия не найдена');

  const revision = { id: doc.id, ...doc.data() } as Revision;

  // Get location name
  const locDoc = await db.collection(COLLECTIONS.LOCATIONS).doc(revision.location_id).get();
  const locationName = locDoc.exists ? locDoc.data()!.name : 'Unknown';

  // Get all shifts at this location for the period
  const startDate = `${revision.period_year}-${String(revision.period_month).padStart(2, '0')}-01`;
  const endMonth = revision.period_month === 12 ? 1 : revision.period_month + 1;
  const endYear = revision.period_month === 12 ? revision.period_year + 1 : revision.period_year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const shiftsSnap = await db
    .collection(COLLECTIONS.SHIFTS)
    .where('location_id', '==', revision.location_id)
    .where('date', '>=', startDate)
    .where('date', '<', endDate)
    .where('status', 'in', ['CLOSED', 'CORRECTED'])
    .get();

  // Calculate per-employee shifts
  const employeeShiftsMap: Record<string, { full: number; half: number }> = {};

  shiftsSnap.forEach((shiftDoc) => {
    const data = shiftDoc.data();

    // First master
    if (!employeeShiftsMap[data.first_master_id]) {
      employeeShiftsMap[data.first_master_id] = { full: 0, half: 0 };
    }
    employeeShiftsMap[data.first_master_id].full++;

    // Second master
    if (data.second_master_id) {
      if (!employeeShiftsMap[data.second_master_id]) {
        employeeShiftsMap[data.second_master_id] = { full: 0, half: 0 };
      }
      employeeShiftsMap[data.second_master_id].half++;
    }
  });

  // Calculate revision results per employee
  const results: RevisionEmployeeResult[] = [];

  for (const [employeeId, shifts] of Object.entries(employeeShiftsMap)) {
    const empDoc = await db.collection(COLLECTIONS.EMPLOYEES).doc(employeeId).get();
    const empName = empDoc.exists ? empDoc.data()!.name : 'Unknown';

    const employeeShifts = calculateEmployeeShifts(shifts.full, shifts.half);
    const revisionDiff = calculateRevisionDifference({
      shouldBe: revision.should_be,
      actuallyAvailable: revision.actually_available,
      totalLocationShifts: revision.total_location_shifts,
      employeeShifts,
    });

    results.push({
      employee_id: employeeId,
      employee_name: empName,
      full_shifts: shifts.full,
      half_shifts: shifts.half,
      employee_shifts: employeeShifts,
      revision_difference: Math.round(revisionDiff * 100) / 100,
    });
  }

  // Sort by employee name
  results.sort((a, b) => a.employee_name.localeCompare(b.employee_name));

  return sendSuccess(res, {
    revision: {
      ...revision,
      location_name: locationName,
    },
    employee_results: results,
  });
}

async function updateRevision(
  req: VercelRequest,
  res: VercelResponse,
  admin: { uid: string; email: string },
  revisionId: string
) {
  const input = revisionUpdateSchema.parse(req.body);
  const db = getDb();

  const doc = await db.collection(COLLECTIONS.REVISIONS).doc(revisionId).get();
  if (!doc.exists) throw new NotFoundError('Ревизия не найдена');

  const oldData = doc.data()!;
  const changes = Object.entries(input)
    .filter(([key, value]) => oldData[key] !== value)
    .map(([key, value]) => ({
      field: key,
      old_value: oldData[key],
      new_value: value,
    }));

  if (changes.length > 0) {
    await db.collection(COLLECTIONS.REVISIONS).doc(revisionId).update({
      ...input,
      updated_at: FieldValue.serverTimestamp(),
    });

    await logAudit({
      actorType: 'admin',
      actorId: admin.uid,
      actorEmail: admin.email,
      action: AUDIT_ACTIONS.UPDATE_REVISION,
      entityType: 'revision',
      entityId: revisionId,
      changes,
    });
  }

  const updatedDoc = await db.collection(COLLECTIONS.REVISIONS).doc(revisionId).get();
  return sendSuccess(res, { revision: { id: updatedDoc.id, ...updatedDoc.data() } });
}
