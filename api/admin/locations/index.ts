// ==========================================
// /api/admin/locations
// ==========================================
// GET: List all locations
// POST: Create new location

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, sendSuccess, sendError } from '../../_lib/helpers.js';
import { authAdmin } from '../../_lib/auth.js';
import { logAudit } from '../../_lib/audit.js';
import { getDb } from '@crm/firebase-config';
import { COLLECTIONS, AUDIT_ACTIONS, locationCreateSchema } from '@crm/shared';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    const admin = await authAdmin(req);

    switch (req.method) {
      case 'GET':
        return await listLocations(res);
      case 'POST':
        return await createLocation(req, res, admin);
      default:
        return sendError(res, { statusCode: 405, message: 'Method not allowed' });
    }
  } catch (error) {
    return sendError(res, error);
  }
}

async function listLocations(res: VercelResponse) {
  const db = getDb();
  const snapshot = await db.collection(COLLECTIONS.LOCATIONS).orderBy('name').get();

  const locations = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return sendSuccess(res, { locations });
}

async function createLocation(
  req: VercelRequest,
  res: VercelResponse,
  admin: { uid: string; email: string }
) {
  const input = locationCreateSchema.parse(req.body);
  const db = getDb();

  const locationData = {
    ...input,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };

  const docRef = await db.collection(COLLECTIONS.LOCATIONS).add(locationData);

  await logAudit({
    actorType: 'admin',
    actorId: admin.uid,
    actorEmail: admin.email,
    action: AUDIT_ACTIONS.CREATE_LOCATION,
    entityType: 'location',
    entityId: docRef.id,
    changes: [{ field: 'created', old_value: null, new_value: input }],
  });

  return sendSuccess(res, {
    location: { id: docRef.id, ...locationData },
  }, 201);
}
