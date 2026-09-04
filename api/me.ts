// ==========================================
// GET /api/me
// ==========================================
// Returns the authenticated master's profile.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, sendSuccess, sendError } from '../_lib/helpers.js';
import { authMaster } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, { statusCode: 405, message: 'Method not allowed' });
  }

  try {
    const { employee } = await authMaster(req);

    return sendSuccess(res, {
      employee: {
        id: employee.id,
        name: employee.name,
        telegram_id: employee.telegram_id,
        salary_base: employee.salary_base,
        salary_per_sale: employee.salary_per_sale,
        location_ids: employee.location_ids,
        status: employee.status,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
}
