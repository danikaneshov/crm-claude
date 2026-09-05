// ==========================================
// GET /api/locations
// ==========================================
// Returns locations accessible to the authenticated master.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, sendSuccess, sendError } from '../_lib/helpers';
import { authMaster } from '../_lib/auth';
import { getDb } from '@crm/firebase-config';
import { COLLECTIONS } from '@crm/shared';
import type { Location } from '@crm/shared';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, { statusCode: 405, message: 'Method not allowed' });
  }

  try {
    const { employee } = await authMaster(req);

    if (!employee.location_ids || employee.location_ids.length === 0) {
      return sendSuccess(res, { locations: [] });
    }

    const db = getDb();

    // Firestore 'in' query supports up to 30 values
    const locationDocs = await db
      .collection(COLLECTIONS.LOCATIONS)
      .where('is_active', '==', true)
      .get();

    const locations: Partial<Location>[] = [];
    locationDocs.forEach((doc) => {
      if (employee.location_ids.includes(doc.id)) {
        const data = doc.data();
        locations.push({
          id: doc.id,
          name: data.name,
          is_active: data.is_active,
        });
      }
    });

    return sendSuccess(res, { locations });
  } catch (error) {
    return sendError(res, error);
  }
}
