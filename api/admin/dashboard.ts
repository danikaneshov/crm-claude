// ==========================================
// GET /api/admin/dashboard
// ==========================================
// Returns aggregated stats for dashboard.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, sendSuccess, sendError } from '../../_lib/helpers.js';
import { authAdmin } from '../../_lib/auth.js';
import { getDb } from '@crm/firebase-config';
import { COLLECTIONS, dashboardQuerySchema } from '@crm/shared';
import type { DashboardStats } from '@crm/shared';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, { statusCode: 405, message: 'Method not allowed' });
  }

  try {
    await authAdmin(req);
    const filters = dashboardQuerySchema.parse(req.query);
    const db = getDb();

    // Build date range
    const startDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`;
    const endMonth = filters.month === 12 ? 1 : filters.month + 1;
    const endYear = filters.month === 12 ? filters.year + 1 : filters.year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

    let query: FirebaseFirestore.Query = db
      .collection(COLLECTIONS.SHIFTS)
      .where('date', '>=', startDate)
      .where('date', '<', endDate);

    if (filters.location_id) {
      query = query.where('location_id', '==', filters.location_id);
    }

    const snapshot = await query.get();

    const stats: DashboardStats = {
      total_hookahs: 0,
      total_replacements: 0,
      total_sales: 0,
      total_shifts: 0,
      active_masters: 0,
      total_salary_fund: 0,
    };

    const masterIds = new Set<string>();
    const dailySales: Record<string, number> = {};
    const masterSales: Record<string, { name_id: string; sales: number; salary: number }> = {};

    snapshot.forEach((doc) => {
      const data = doc.data();

      // Only count closed/corrected shifts
      if (data.status !== 'CLOSED' && data.status !== 'CORRECTED') return;

      // Apply employee filter in-memory
      if (filters.employee_id) {
        if (data.first_master_id !== filters.employee_id && data.second_master_id !== filters.employee_id) {
          return;
        }
      }

      stats.total_hookahs += data.final_hookahs ?? 0;
      stats.total_replacements += data.final_replacements ?? 0;
      stats.total_sales += data.total_sales ?? 0;
      stats.total_shifts++;
      stats.total_salary_fund += (data.first_master_salary ?? 0) + (data.second_master_salary ?? 0);

      masterIds.add(data.first_master_id);
      if (data.second_master_id) masterIds.add(data.second_master_id);

      // Daily sales
      const day = data.date;
      dailySales[day] = (dailySales[day] || 0) + (data.total_sales ?? 0);

      // Master sales
      if (!masterSales[data.first_master_id]) {
        masterSales[data.first_master_id] = { name_id: data.first_master_id, sales: 0, salary: 0 };
      }
      masterSales[data.first_master_id].sales += data.first_master_sales ?? 0;
      masterSales[data.first_master_id].salary += data.first_master_salary ?? 0;

      if (data.second_master_id) {
        if (!masterSales[data.second_master_id]) {
          masterSales[data.second_master_id] = { name_id: data.second_master_id, sales: 0, salary: 0 };
        }
        masterSales[data.second_master_id].sales += data.second_master_sales ?? 0;
        masterSales[data.second_master_id].salary += data.second_master_salary ?? 0;
      }
    });

    stats.active_masters = masterIds.size;

    // Resolve master names
    const masterNamesMap: Record<string, string> = {};
    for (const id of masterIds) {
      const empDoc = await db.collection(COLLECTIONS.EMPLOYEES).doc(id).get();
      if (empDoc.exists) masterNamesMap[id] = empDoc.data()!.name;
    }

    const masterStats = Object.entries(masterSales).map(([id, data]) => ({
      id,
      name: masterNamesMap[id] || 'Unknown',
      sales: data.sales,
      salary: data.salary,
    }));

    // Sort daily sales by date
    const dailyData = Object.entries(dailySales)
      .map(([date, sales]) => ({ date, sales }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return sendSuccess(res, {
      stats,
      charts: {
        daily_sales: dailyData,
        master_stats: masterStats,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
}
