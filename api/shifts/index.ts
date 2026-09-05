// ==========================================
// /api/shifts
// ==========================================
// POST: Open a new shift
// GET: Get shift history for authenticated master

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, sendSuccess, sendError, BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../_lib/helpers';
import { authMaster } from '../_lib/auth';
import { getDb } from '@crm/firebase-config';
import { COLLECTIONS, SHIFT_STATUS, shiftOpenSchema, SHIFT_COEFFICIENTS } from '@crm/shared';
import type { Employee, Location } from '@crm/shared';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    switch (req.method) {
      case 'POST':
        return await openShift(req, res);
      case 'GET':
        return await getShiftHistory(req, res);
      default:
        return sendError(res, { statusCode: 405, message: 'Method not allowed' });
    }
  } catch (error) {
    return sendError(res, error);
  }
}

async function openShift(req: VercelRequest, res: VercelResponse) {
  const { employee } = await authMaster(req);
  const input = shiftOpenSchema.parse(req.body);
  const db = getDb();

  // 1. Verify master has access to location
  if (!employee.location_ids.includes(input.location_id)) {
    throw new ForbiddenError('У вас нет доступа к этой точке');
  }

  // 2. Get location details
  const locationDoc = await db.collection(COLLECTIONS.LOCATIONS).doc(input.location_id).get();
  if (!locationDoc.exists) {
    throw new NotFoundError('Точка не найдена');
  }
  const location = { id: locationDoc.id, ...locationDoc.data() } as Location;
  if (!location.is_active) {
    throw new BadRequestError('Точка деактивирована');
  }

  // 3. Check master doesn't have an open shift (as first or second master)
  const openAsFirst = await db
    .collection(COLLECTIONS.SHIFTS)
    .where('first_master_id', '==', employee.id)
    .where('status', 'in', [SHIFT_STATUS.OPEN, SHIFT_STATUS.PROCESSING])
    .limit(1)
    .get();

  if (!openAsFirst.empty) {
    throw new ConflictError('У вас уже есть открытая смена');
  }

  const openAsSecond = await db
    .collection(COLLECTIONS.SHIFTS)
    .where('second_master_id', '==', employee.id)
    .where('status', 'in', [SHIFT_STATUS.OPEN, SHIFT_STATUS.PROCESSING])
    .limit(1)
    .get();

  if (!openAsSecond.empty) {
    throw new ConflictError('Вы уже участвуете как второй мастер в открытой смене');
  }

  // 4. Handle second master
  let secondMaster: Employee | null = null;
  if (input.second_master_id) {
    if (input.second_master_id === employee.id) {
      throw new BadRequestError('Нельзя выбрать себя вторым мастером');
    }

    const secondDoc = await db.collection(COLLECTIONS.EMPLOYEES).doc(input.second_master_id).get();
    if (!secondDoc.exists) {
      throw new NotFoundError('Второй мастер не найден');
    }
    secondMaster = { id: secondDoc.id, ...secondDoc.data() } as Employee;

    if (!secondMaster.is_active) {
      throw new BadRequestError('Второй мастер деактивирован');
    }

    if (!secondMaster.location_ids.includes(input.location_id)) {
      throw new BadRequestError('Второй мастер не имеет доступа к этой точке');
    }

    // Check second master doesn't have an open shift (as first or second master)
    const secondOpenAsFirst = await db
      .collection(COLLECTIONS.SHIFTS)
      .where('first_master_id', '==', secondMaster.id)
      .where('status', 'in', [SHIFT_STATUS.OPEN, SHIFT_STATUS.PROCESSING])
      .limit(1)
      .get();

    if (!secondOpenAsFirst.empty) {
      throw new ConflictError('Второй мастер уже имеет открытую смену');
    }

    const secondOpenAsSecond = await db
      .collection(COLLECTIONS.SHIFTS)
      .where('second_master_id', '==', secondMaster.id)
      .where('status', 'in', [SHIFT_STATUS.OPEN, SHIFT_STATUS.PROCESSING])
      .limit(1)
      .get();

    if (!secondOpenAsSecond.empty) {
      throw new ConflictError('Второй мастер уже участвует в другой смене');
    }
  }

  // 5. Create shift document
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // "2026-08-25"

  const shiftData = {
    location_id: input.location_id,

    first_master_id: employee.id,
    second_master_id: secondMaster?.id || null,

    first_master_shift_coefficient: SHIFT_COEFFICIENTS.FIRST_MASTER,
    second_master_shift_coefficient: secondMaster ? SHIFT_COEFFICIENTS.SECOND_MASTER : 0,

    date: dateStr,
    opened_at: FieldValue.serverTimestamp(),
    closed_at: null,

    status: SHIFT_STATUS.OPEN,

    // AI results
    ai_hookahs: null,
    ai_replacements: null,
    ai_confidence: null,
    ai_raw_response: null,

    // Final results
    final_hookahs: null,
    final_replacements: null,

    // Calculated
    total_sales: null,
    first_master_sales: null,
    second_master_sales: null,
    first_master_salary: null,
    second_master_salary: null,

    // Rate snapshots
    first_master_salary_base_snapshot: employee.salary_base,
    first_master_salary_per_sale_snapshot: employee.salary_per_sale,
    second_master_salary_base_snapshot: secondMaster?.salary_base ?? null,
    second_master_salary_per_sale_snapshot: secondMaster?.salary_per_sale ?? null,

    // Location salary rules snapshot
    location_salary_rules_snapshot: location.salary_rules,

    // Report storage
    report_storage: null,
    telegram_chat_id: null,
    telegram_message_id: null,
    telegram_file_id: null,
    telegram_file_unique_id: null,

    // Flags
    is_anomalous: false,
    anomaly_reason: null,

    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };

  const shiftRef = await db.collection(COLLECTIONS.SHIFTS).add(shiftData);

  return sendSuccess(res, {
    shift: {
      id: shiftRef.id,
      ...shiftData,
      location_name: location.name,
      first_master_name: employee.name,
      second_master_name: secondMaster?.name || null,
    },
  }, 201);
}

async function getShiftHistory(req: VercelRequest, res: VercelResponse) {
  const { employee } = await authMaster(req);
  const db = getDb();

  // Get shifts where master is first or second
  const [asFirstSnap, asSecondSnap] = await Promise.all([
    db
      .collection(COLLECTIONS.SHIFTS)
      .where('first_master_id', '==', employee.id)
      .orderBy('date', 'desc')
      .limit(50)
      .get(),
    db
      .collection(COLLECTIONS.SHIFTS)
      .where('second_master_id', '==', employee.id)
      .orderBy('date', 'desc')
      .limit(50)
      .get(),
  ]);

  // Merge and sort
  const shifts: Array<Record<string, unknown>> = [];
  const seenIds = new Set<string>();

  const processDocs = (docs: FirebaseFirestore.QuerySnapshot) => {
    docs.forEach((doc) => {
      if (!seenIds.has(doc.id)) {
        seenIds.add(doc.id);
        shifts.push({ id: doc.id, ...doc.data() });
      }
    });
  };

  processDocs(asFirstSnap);
  processDocs(asSecondSnap);

  // Sort by date descending
  shifts.sort((a, b) => {
    const dateA = a.date as string;
    const dateB = b.date as string;
    return dateB.localeCompare(dateA);
  });

  // Enrich with location names
  const locationIds = [...new Set(shifts.map((s) => s.location_id as string))];
  const locationMap: Record<string, string> = {};
  for (const locId of locationIds) {
    const locDoc = await db.collection(COLLECTIONS.LOCATIONS).doc(locId).get();
    if (locDoc.exists) {
      locationMap[locId] = locDoc.data()!.name;
    }
  }

  const enrichedShifts = shifts.map((s) => ({
    ...s,
    location_name: locationMap[s.location_id as string] || 'Unknown',
    is_second_master: s.second_master_id === employee.id,
  }));

  return sendSuccess(res, { shifts: enrichedShifts.slice(0, 50) });
}
