// ==========================================
// GET /api/admin/audit
// ==========================================
// Returns the audit log.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, sendSuccess, sendError } from '../../_lib/helpers';
import { authAdmin } from '../../_lib/auth';
import { getDb } from '@crm/firebase-config';
import { COLLECTIONS, auditQuerySchema } from '@crm/shared';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, { statusCode: 405, message: 'Method not allowed' });
  }

  try {
    await authAdmin(req);
    const filters = auditQuerySchema.parse(req.query);
    const db = getDb();

    let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.AUDIT_LOG);

    if (filters.entity_type) {
      query = query.where('entity_type', '==', filters.entity_type);
    }

    if (filters.entity_id) {
      query = query.where('entity_id', '==', filters.entity_id);
    }

    query = query
      .orderBy('created_at', 'desc')
      .limit(filters.limit)
      .offset(filters.offset);

    const snapshot = await query.get();

    const entries = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return sendSuccess(res, { entries });
  } catch (error) {
    return sendError(res, error);
  }
}
