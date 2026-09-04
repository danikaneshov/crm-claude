// ==========================================
// /api/admin/revisions
// ==========================================
// GET: List revisions
// POST: Create revision

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, sendSuccess, sendError } from '../../_lib/helpers.js';
import { authAdmin } from '../../_lib/auth.js';
import { logAudit } from '../../_lib/audit.js';
import { getDb } from '@crm/firebase-config';
import {
  COLLECTIONS,
  AUDIT_ACTIONS,
  revisionCreateSchema,
  calculateRevisionDifference,
  calculateEmployeeShifts,
} from '@crm/shared';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    const admin = await authAdmin(req);

    switch (req.method) {
      case 'GET':
        return await listRevisions(req, res);
      case 'POST':
        return await createRevision(req, res, admin);
      default:
        return sendError(res, { statusCode: 405, message: 'Method not allowed' });
    }
  } catch (error) {
    return sendError(res, error);
  }
}

async function listRevisions(req: VercelRequest, res: VercelResponse) {
  const db = getDb();

  let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.REVISIONS);

  const locationId = req.query.location_id as string;
  if (locationId) {
    query = query.where('location_id', '==', locationId);
  }

  query = query.orderBy('period_year', 'desc').orderBy('period_month', 'desc');

  const snapshot = await query.get();

  // Enrich with location names
  const locationIds = new Set<string>();
  snapshot.forEach((doc) => locationIds.add(doc.data().location_id));

  const locationMap: Record<string, string> = {};
  for (const id of locationIds) {
    const locDoc = await db.collection(COLLECTIONS.LOCATIONS).doc(id).get();
    if (locDoc.exists) locationMap[id] = locDoc.data()!.name;
  }

  const revisions = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    location_name: locationMap[doc.data().location_id] || 'Unknown',
  }));

  return sendSuccess(res, { revisions });
}

async function createRevision(
  req: VercelRequest,
  res: VercelResponse,
  admin: { uid: string; email: string }
) {
  const input = revisionCreateSchema.parse(req.body);
  const db = getDb();

  // Calculate total shifts at this location for the period
  const startDate = `${input.period_year}-${String(input.period_month).padStart(2, '0')}-01`;
  const endMonth = input.period_month === 12 ? 1 : input.period_month + 1;
  const endYear = input.period_month === 12 ? input.period_year + 1 : input.period_year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const shiftsSnap = await db
    .collection(COLLECTIONS.SHIFTS)
    .where('location_id', '==', input.location_id)
    .where('date', '>=', startDate)
    .where('date', '<', endDate)
    .where('status', 'in', ['CLOSED', 'CORRECTED'])
    .get();

  // Count total shifts (each shift = 1, regardless of solo or duo)
  const totalShifts = shiftsSnap.size;

  const revisionData = {
    ...input,
    total_location_shifts: totalShifts,
    status: 'draft' as const,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };

  const docRef = await db.collection(COLLECTIONS.REVISIONS).add(revisionData);

  await logAudit({
    actorType: 'admin',
    actorId: admin.uid,
    actorEmail: admin.email,
    action: AUDIT_ACTIONS.CREATE_REVISION,
    entityType: 'revision',
    entityId: docRef.id,
    changes: [{ field: 'created', old_value: null, new_value: input }],
  });

  return sendSuccess(res, {
    revision: { id: docRef.id, ...revisionData },
  }, 201);
}
