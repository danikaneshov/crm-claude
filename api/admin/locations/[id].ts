// ==========================================
// /api/admin/locations/[id]
// ==========================================
// GET: Get location details
// PUT: Update location

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, sendSuccess, sendError, NotFoundError } from '../../_lib/helpers';
import { authAdmin } from '../../_lib/auth';
import { logAudit } from '../../_lib/audit';
import { getDb } from '@crm/firebase-config';
import { COLLECTIONS, AUDIT_ACTIONS, locationUpdateSchema } from '@crm/shared';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    const admin = await authAdmin(req);
    const locationId = req.query.id as string;
    if (!locationId) throw new NotFoundError('Location ID required');

    switch (req.method) {
      case 'GET': {
        const db = getDb();
        const doc = await db.collection(COLLECTIONS.LOCATIONS).doc(locationId).get();
        if (!doc.exists) throw new NotFoundError('Точка не найдена');
        return sendSuccess(res, { location: { id: doc.id, ...doc.data() } });
      }
      case 'PUT': {
        const input = locationUpdateSchema.parse(req.body);
        const db = getDb();

        const doc = await db.collection(COLLECTIONS.LOCATIONS).doc(locationId).get();
        if (!doc.exists) throw new NotFoundError('Точка не найдена');

        const oldData = doc.data()!;
        const changes = Object.entries(input)
          .filter(([key, value]) => JSON.stringify(oldData[key]) !== JSON.stringify(value))
          .map(([key, value]) => ({
            field: key,
            old_value: oldData[key],
            new_value: value,
          }));

        if (changes.length > 0) {
          await db.collection(COLLECTIONS.LOCATIONS).doc(locationId).update({
            ...input,
            updated_at: FieldValue.serverTimestamp(),
          });

          await logAudit({
            actorType: 'admin',
            actorId: admin.uid,
            actorEmail: admin.email,
            action: AUDIT_ACTIONS.UPDATE_LOCATION,
            entityType: 'location',
            entityId: locationId,
            changes,
          });
        }

        const updatedDoc = await db.collection(COLLECTIONS.LOCATIONS).doc(locationId).get();
        return sendSuccess(res, { location: { id: updatedDoc.id, ...updatedDoc.data() } });
      }
      default:
        return sendError(res, { statusCode: 405, message: 'Method not allowed' });
    }
  } catch (error) {
    return sendError(res, error);
  }
}
