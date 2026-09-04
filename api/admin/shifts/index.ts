// ==========================================
// /api/admin/shifts
// ==========================================
// GET: List shifts with filters

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, sendSuccess, sendError } from '../../_lib/helpers.js';
import { authAdmin } from '../../_lib/auth.js';
import { getDb } from '@crm/firebase-config';
import { COLLECTIONS, shiftsQuerySchema } from '@crm/shared';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, { statusCode: 405, message: 'Method not allowed' });
  }

  try {
    await authAdmin(req);
    const filters = shiftsQuerySchema.parse(req.query);
    const db = getDb();

    let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.SHIFTS);

    // Apply filters
    if (filters.location_id) {
      query = query.where('location_id', '==', filters.location_id);
    }

    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }

    if (filters.year && filters.month) {
      const startDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`;
      const endMonth = filters.month === 12 ? 1 : filters.month + 1;
      const endYear = filters.month === 12 ? filters.year + 1 : filters.year;
      const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
      query = query.where('date', '>=', startDate).where('date', '<', endDate);
    }

    query = query.orderBy('date', 'desc').limit(filters.limit).offset(filters.offset);

    const snapshot = await query.get();

    // Enrich with names
    const employeeIds = new Set<string>();
    const locationIds = new Set<string>();
    snapshot.forEach((doc) => {
      const data = doc.data();
      employeeIds.add(data.first_master_id);
      if (data.second_master_id) employeeIds.add(data.second_master_id);
      locationIds.add(data.location_id);
    });

    const [employeeMap, locationMap] = await Promise.all([
      resolveNames(db, COLLECTIONS.EMPLOYEES, [...employeeIds]),
      resolveNames(db, COLLECTIONS.LOCATIONS, [...locationIds]),
    ]);

    const shifts = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        first_master_name: employeeMap[data.first_master_id] || 'Unknown',
        second_master_name: data.second_master_id ? employeeMap[data.second_master_id] || 'Unknown' : null,
        location_name: locationMap[data.location_id] || 'Unknown',
      };
    });

    // If employee filter is set, filter in-memory
    let filteredShifts = shifts;
    if (filters.employee_id) {
      filteredShifts = shifts.filter(
        (s) => s.first_master_id === filters.employee_id || s.second_master_id === filters.employee_id
      );
    }

    return sendSuccess(res, { shifts: filteredShifts });
  } catch (error) {
    return sendError(res, error);
  }
}

async function resolveNames(
  db: FirebaseFirestore.Firestore,
  collection: string,
  ids: string[]
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const id of ids) {
    const doc = await db.collection(collection).doc(id).get();
    if (doc.exists) {
      map[id] = doc.data()!.name;
    }
  }
  return map;
}
