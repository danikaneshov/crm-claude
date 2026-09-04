// ==========================================
// GET /api/admin/shifts/[id]/photo
// ==========================================
// Returns the report photo from Telegram storage.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, sendError, NotFoundError, BadRequestError } from '../../../_lib/helpers.js';
import { authAdmin } from '../../../_lib/auth.js';
import { getDb } from '@crm/firebase-config';
import { COLLECTIONS } from '@crm/shared';
import { downloadPhotoFromTelegram } from '@crm/telegram';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, { statusCode: 405, message: 'Method not allowed' });
  }

  try {
    await authAdmin(req);
    const shiftId = req.query.id as string;
    if (!shiftId) throw new NotFoundError('Shift ID required');

    const db = getDb();
    const doc = await db.collection(COLLECTIONS.SHIFTS).doc(shiftId).get();
    if (!doc.exists) throw new NotFoundError('Смена не найдена');

    const data = doc.data()!;
    if (!data.telegram_file_id) {
      throw new BadRequestError('Фотография отчёта отсутствует');
    }

    const photoBuffer = await downloadPhotoFromTelegram(data.telegram_file_id);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(photoBuffer);
  } catch (error) {
    return sendError(res, error);
  }
}
