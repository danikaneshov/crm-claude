// ==========================================
// GET /api/employees/colleagues
// ==========================================
// Returns list of colleagues at a given location (for second master selection).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, sendSuccess, sendError, BadRequestError } from '../../_lib/helpers.js';
import { authMaster } from '../../_lib/auth.js';
import { getDb } from '@crm/firebase-config';
import { COLLECTIONS } from '@crm/shared';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, { statusCode: 405, message: 'Method not allowed' });
  }

  try {
    const { employee } = await authMaster(req);
    const locationId = req.query.location_id as string;

    if (!locationId) {
      throw new BadRequestError('location_id is required');
    }

    if (!employee.location_ids.includes(locationId)) {
      throw new BadRequestError('Нет доступа к этой точке');
    }

    const db = getDb();

    // Get all active employees that have access to this location
    const snapshot = await db
      .collection(COLLECTIONS.EMPLOYEES)
      .where('is_active', '==', true)
      .get();

    const colleagues: Array<{ id: string; name: string }> = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      // Exclude self and only include those with access to this location
      if (doc.id !== employee.id && data.location_ids?.includes(locationId)) {
        colleagues.push({
          id: doc.id,
          name: data.name,
        });
      }
    });

    return sendSuccess(res, { colleagues });
  } catch (error) {
    return sendError(res, error);
  }
}
