// ==========================================
// GET /api/shifts/current
// ==========================================
// Returns the master's current open shift (if any).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, sendSuccess, sendError } from '../../_lib/helpers.js';
import { authMaster } from '../../_lib/auth.js';
import { getDb } from '@crm/firebase-config';
import { COLLECTIONS, SHIFT_STATUS } from '@crm/shared';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, { statusCode: 405, message: 'Method not allowed' });
  }

  try {
    const { employee } = await authMaster(req);
    const db = getDb();

    // Check as first master
    const asFirstSnap = await db
      .collection(COLLECTIONS.SHIFTS)
      .where('first_master_id', '==', employee.id)
      .where('status', 'in', [SHIFT_STATUS.OPEN, SHIFT_STATUS.PROCESSING])
      .limit(1)
      .get();

    if (!asFirstSnap.empty) {
      const doc = asFirstSnap.docs[0];
      const shiftData = doc.data();
      
      // Get location name
      const locDoc = await db.collection(COLLECTIONS.LOCATIONS).doc(shiftData.location_id).get();
      
      // Get second master name
      let secondMasterName = null;
      if (shiftData.second_master_id) {
        const secondDoc = await db.collection(COLLECTIONS.EMPLOYEES).doc(shiftData.second_master_id).get();
        if (secondDoc.exists) {
          secondMasterName = secondDoc.data()!.name;
        }
      }

      return sendSuccess(res, {
        shift: {
          id: doc.id,
          ...shiftData,
          location_name: locDoc.exists ? locDoc.data()!.name : 'Unknown',
          first_master_name: employee.name,
          second_master_name: secondMasterName,
          is_second_master: false,
        },
      });
    }

    // Check as second master
    const asSecondSnap = await db
      .collection(COLLECTIONS.SHIFTS)
      .where('second_master_id', '==', employee.id)
      .where('status', 'in', [SHIFT_STATUS.OPEN, SHIFT_STATUS.PROCESSING])
      .limit(1)
      .get();

    if (!asSecondSnap.empty) {
      const doc = asSecondSnap.docs[0];
      const shiftData = doc.data();
      
      const locDoc = await db.collection(COLLECTIONS.LOCATIONS).doc(shiftData.location_id).get();
      const firstDoc = await db.collection(COLLECTIONS.EMPLOYEES).doc(shiftData.first_master_id).get();

      return sendSuccess(res, {
        shift: {
          id: doc.id,
          ...shiftData,
          location_name: locDoc.exists ? locDoc.data()!.name : 'Unknown',
          first_master_name: firstDoc.exists ? firstDoc.data()!.name : 'Unknown',
          second_master_name: employee.name,
          is_second_master: true,
        },
      });
    }

    return sendSuccess(res, { shift: null });
  } catch (error) {
    return sendError(res, error);
  }
}
