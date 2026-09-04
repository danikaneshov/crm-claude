// ==========================================
// POST /api/auth/telegram
// ==========================================
// Validates Telegram initData and returns JWT + employee info.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, sendSuccess, sendError } from '../_lib/helpers.js';
import { authenticateWithTelegram } from '../_lib/auth.js';
import { telegramAuthSchema } from '@crm/shared';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, { statusCode: 405, message: 'Method not allowed' });
  }

  try {
    // Accept initData from body or header
    const initData =
      req.body?.initData ||
      req.headers['x-telegram-init-data'] as string;

    const validated = telegramAuthSchema.parse({ initData });
    const { token, employee } = await authenticateWithTelegram(validated.initData);

    return sendSuccess(res, {
      token,
      employee: {
        id: employee.id,
        name: employee.name,
        location_ids: employee.location_ids,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
}
