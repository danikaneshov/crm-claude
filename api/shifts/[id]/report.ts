// ==========================================
// POST /api/shifts/[id]/report
// ==========================================
// Upload a report photo and process it with AI.
// This is the main pipeline: photo → Telegram → Gemini → salary calculation.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, sendSuccess, sendError, BadRequestError, ForbiddenError, NotFoundError } from '../../_lib/helpers.js';
import { authMaster } from '../../_lib/auth.js';
import { getDb } from '@crm/firebase-config';
import {
  COLLECTIONS,
  SHIFT_STATUS,
  calculateShiftResults,
  checkAnomaly,
} from '@crm/shared';
import type { Shift, Location } from '@crm/shared';
import { uploadPhotoToChannel, downloadPhotoFromTelegram } from '@crm/telegram';
import { analyzeReport } from '../../_lib/gemini.js';
import { FieldValue } from 'firebase-admin/firestore';

// Vercel config for file uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, { statusCode: 405, message: 'Method not allowed' });
  }

  try {
    const { employee } = await authMaster(req);
    const shiftId = req.query.id as string;
    if (!shiftId) throw new BadRequestError('Missing shift ID');

    const db = getDb();

    // 1. Get shift and validate ownership
    const shiftDoc = await db.collection(COLLECTIONS.SHIFTS).doc(shiftId).get();
    if (!shiftDoc.exists) throw new NotFoundError('Смена не найдена');

    const shift = { id: shiftDoc.id, ...shiftDoc.data() } as Shift;

    if (shift.first_master_id !== employee.id) {
      throw new ForbiddenError('Только первый мастер может загрузить отчёт');
    }

    if (shift.status !== SHIFT_STATUS.OPEN) {
      throw new BadRequestError('Смена не в статусе OPEN');
    }

    // 2. Get photo from request body
    // Expect base64 encoded photo in body
    const photoBase64 = req.body?.photo;
    if (!photoBase64) {
      throw new BadRequestError('Фотография отчёта обязательна');
    }

    const photoBuffer = Buffer.from(photoBase64, 'base64');

    // 3. Set status to PROCESSING
    await db.collection(COLLECTIONS.SHIFTS).doc(shiftId).update({
      status: SHIFT_STATUS.PROCESSING,
      updated_at: FieldValue.serverTimestamp(),
    });

    // 4. Upload photo to Telegram channel
    const telegramResult = await uploadPhotoToChannel(
      photoBuffer,
      `Смена ${shiftId} | ${shift.date} | ${employee.name}`
    );

    // 5. Save Telegram metadata
    await db.collection(COLLECTIONS.SHIFTS).doc(shiftId).update({
      report_storage: 'telegram',
      telegram_chat_id: telegramResult.chat_id,
      telegram_message_id: telegramResult.message_id,
      telegram_file_id: telegramResult.file_id,
      telegram_file_unique_id: telegramResult.file_unique_id,
    });

    // 6. Download photo from Telegram (for Gemini processing)
    const imageBuffer = await downloadPhotoFromTelegram(telegramResult.file_id);

    // 7. Get location r_keeper mapping
    const locationDoc = await db.collection(COLLECTIONS.LOCATIONS).doc(shift.location_id).get();
    if (!locationDoc.exists) throw new NotFoundError('Точка не найдена');
    const location = { id: locationDoc.id, ...locationDoc.data() } as Location;

    // 8. Send to Gemini for analysis
    const aiResult = await analyzeReport(imageBuffer, location.rkeeper_mapping);

    // 9. Save AI result
    await db.collection(COLLECTIONS.SHIFTS).doc(shiftId).update({
      ai_hookahs: aiResult.hookahs,
      ai_replacements: aiResult.replacements,
      ai_confidence: aiResult.confidence ?? null,
      ai_raw_response: JSON.stringify(aiResult),
    });

    // 10. Check if AI failed
    if (aiResult.hookahs === null || aiResult.replacements === null) {
      await db.collection(COLLECTIONS.SHIFTS).doc(shiftId).update({
        status: SHIFT_STATUS.ERROR,
        updated_at: FieldValue.serverTimestamp(),
      });

      return sendSuccess(res, {
        success: false,
        error: 'Не удалось распознать отчёт. Обратитесь к администратору.',
        shift_id: shiftId,
        status: SHIFT_STATUS.ERROR,
      });
    }

    // 11. Check anomalies
    const anomaly = checkAnomaly(aiResult.hookahs, aiResult.replacements);

    // 12. Calculate sales & salary
    const hasTwoMasters = shift.second_master_id !== null;
    const locationRules = shift.location_salary_rules_snapshot;

    const results = calculateShiftResults({
      hookahs: aiResult.hookahs,
      replacements: aiResult.replacements,
      firstMasterSalaryBase: shift.first_master_salary_base_snapshot,
      firstMasterSalaryPerSale: shift.first_master_salary_per_sale_snapshot,
      secondMasterSalaryBase: shift.second_master_salary_base_snapshot,
      secondMasterSalaryPerSale: shift.second_master_salary_per_sale_snapshot,
      hasTwoMasters,
      locationRules,
    });

    // 13. Update shift with final results
    await db.collection(COLLECTIONS.SHIFTS).doc(shiftId).update({
      final_hookahs: aiResult.hookahs,
      final_replacements: aiResult.replacements,
      total_sales: results.totalSales,
      first_master_sales: results.firstMasterSales,
      second_master_sales: results.secondMasterSales,
      first_master_salary: results.firstMasterSalary,
      second_master_salary: results.secondMasterSalary,
      is_anomalous: anomaly.isAnomalous,
      anomaly_reason: anomaly.reason,
      status: SHIFT_STATUS.CLOSED,
      closed_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    return sendSuccess(res, {
      success: true,
      shift_id: shiftId,
      status: SHIFT_STATUS.CLOSED,
      ai_result: aiResult,
      is_anomalous: anomaly.isAnomalous,
      anomaly_reason: anomaly.reason,
      results: {
        total_sales: results.totalSales,
        first_master: {
          sales: results.firstMasterSales,
          salary: results.firstMasterSalary,
        },
        second_master: hasTwoMasters
          ? {
              sales: results.secondMasterSales,
              salary: results.secondMasterSalary,
            }
          : null,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
}
