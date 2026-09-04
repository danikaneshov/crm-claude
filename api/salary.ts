// ==========================================
// GET /api/salary
// ==========================================
// Returns salary summary for the authenticated master for a given period.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, sendSuccess, sendError } from '../_lib/helpers.js';
import { authMaster } from '../_lib/auth.js';
import { getDb } from '@crm/firebase-config';
import { COLLECTIONS, salaryQuerySchema } from '@crm/shared';
import type { SalarySummary, ShiftSalaryItem } from '@crm/shared';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, { statusCode: 405, message: 'Method not allowed' });
  }

  try {
    const { employee } = await authMaster(req);
    const { year, month } = salaryQuerySchema.parse(req.query);

    const db = getDb();

    // Build date range for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

    // Get all closed/corrected shifts for this master in the period
    const [asFirstSnap, asSecondSnap] = await Promise.all([
      db
        .collection(COLLECTIONS.SHIFTS)
        .where('first_master_id', '==', employee.id)
        .where('date', '>=', startDate)
        .where('date', '<', endDate)
        .get(),
      db
        .collection(COLLECTIONS.SHIFTS)
        .where('second_master_id', '==', employee.id)
        .where('date', '>=', startDate)
        .where('date', '<', endDate)
        .get(),
    ]);

    // Collect location names
    const locationIds = new Set<string>();
    const allDocs: Array<{ doc: FirebaseFirestore.QueryDocumentSnapshot; isSecond: boolean }> = [];

    asFirstSnap.forEach((doc) => {
      locationIds.add(doc.data().location_id);
      allDocs.push({ doc, isSecond: false });
    });
    asSecondSnap.forEach((doc) => {
      locationIds.add(doc.data().location_id);
      allDocs.push({ doc, isSecond: true });
    });

    const locationMap: Record<string, string> = {};
    for (const locId of locationIds) {
      const locDoc = await db.collection(COLLECTIONS.LOCATIONS).doc(locId).get();
      if (locDoc.exists) {
        locationMap[locId] = locDoc.data()!.name;
      }
    }

    // Build summary
    let totalEarned = 0;
    let fullShifts = 0;
    let halfShifts = 0;
    let totalHookahs = 0;
    let totalReplacements = 0;
    const shiftItems: ShiftSalaryItem[] = [];
    const seenIds = new Set<string>();

    for (const { doc, isSecond } of allDocs) {
      if (seenIds.has(doc.id)) continue;
      seenIds.add(doc.id);

      const data = doc.data();
      const status = data.status;

      // Only count closed or corrected shifts
      if (status !== 'CLOSED' && status !== 'CORRECTED') continue;

      const salary = isSecond ? data.second_master_salary : data.first_master_salary;
      const sales = isSecond ? data.second_master_sales : data.first_master_sales;

      totalEarned += salary ?? 0;

      if (isSecond) {
        halfShifts++;
      } else {
        fullShifts++;
      }

      totalHookahs += data.final_hookahs ?? 0;
      totalReplacements += data.final_replacements ?? 0;

      shiftItems.push({
        shift_id: doc.id,
        date: data.date,
        location_name: locationMap[data.location_id] || 'Unknown',
        hookahs: data.final_hookahs ?? 0,
        replacements: data.final_replacements ?? 0,
        total_sales: sales ?? 0,
        salary: salary ?? 0,
        is_second_master: isSecond,
      });
    }

    // Sort by date descending
    shiftItems.sort((a, b) => b.date.localeCompare(a.date));

    const summary: SalarySummary = {
      year,
      month,
      total_earned: totalEarned,
      total_shifts: fullShifts + halfShifts,
      full_shifts: fullShifts,
      half_shifts: halfShifts,
      total_hookahs: totalHookahs,
      total_replacements: totalReplacements,
      shifts: shiftItems,
    };

    return sendSuccess(res, { salary: summary });
  } catch (error) {
    return sendError(res, error);
  }
}
