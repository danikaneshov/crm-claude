// ==========================================
// API Middleware — Authentication
// ==========================================

import type { VercelRequest } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { validateInitData } from '@crm/telegram';
import { getDb, getAdminAuth } from '@crm/firebase-config';
import { COLLECTIONS } from '@crm/shared';
import type { JWTPayload, Employee } from '@crm/shared';
import { UnauthorizedError, ForbiddenError } from './helpers.js';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  return secret;
}

// --- Master Auth (JWT from Telegram initData) ---

export interface MasterAuthResult {
  employeeId: string;
  telegramId: number;
  employee: Employee;
}

/**
 * Authenticate a master from JWT token.
 * The JWT was issued after Telegram initData validation.
 */
export async function authMaster(req: VercelRequest): Promise<MasterAuthResult> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }

  const token = authHeader.replace('Bearer ', '');

  let payload: JWTPayload;
  try {
    payload = jwt.verify(token, getJwtSecret()) as JWTPayload;
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }

  // Verify employee exists and is active
  const db = getDb();
  const employeeDoc = await db.collection(COLLECTIONS.EMPLOYEES).doc(payload.employee_id).get();

  if (!employeeDoc.exists) {
    throw new UnauthorizedError('Employee not found');
  }

  const employee = { id: employeeDoc.id, ...employeeDoc.data() } as Employee;

  if (!employee.is_active) {
    throw new ForbiddenError('Employee is deactivated');
  }

  return {
    employeeId: employee.id,
    telegramId: payload.telegram_id,
    employee,
  };
}

/**
 * Issue a JWT token for a master after initData validation.
 */
export function issueMasterToken(employeeId: string, telegramId: number): string {
  return jwt.sign(
    {
      employee_id: employeeId,
      telegram_id: telegramId,
    } satisfies Omit<JWTPayload, 'iat' | 'exp'>,
    getJwtSecret(),
    { expiresIn: '24h' }
  );
}

/**
 * Validate Telegram initData and find the associated employee.
 */
export async function authenticateWithTelegram(initData: string): Promise<{
  token: string;
  employee: Employee;
}> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN not set');

  const telegramUser = validateInitData(initData, botToken);

  // Find employee by telegram_id
  const db = getDb();
  const snapshot = await db
    .collection(COLLECTIONS.EMPLOYEES)
    .where('telegram_id', '==', telegramUser.id)
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw new ForbiddenError('Доступ к CRM не предоставлен. Обратитесь к администратору.');
  }

  const employeeDoc = snapshot.docs[0];
  const employee = { id: employeeDoc.id, ...employeeDoc.data() } as Employee;

  if (!employee.is_active) {
    throw new ForbiddenError('Ваш аккаунт деактивирован. Обратитесь к администратору.');
  }

  const token = issueMasterToken(employee.id, telegramUser.id);

  return { token, employee };
}

// --- Admin Auth (Firebase Auth ID Token) ---

export interface AdminAuthResult {
  uid: string;
  email: string;
}

/**
 * Authenticate an admin from Firebase Auth ID token.
 */
export async function authAdmin(req: VercelRequest): Promise<AdminAuthResult> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }

  const idToken = authHeader.replace('Bearer ', '');

  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);

    return {
      uid: decoded.uid,
      email: decoded.email || 'unknown',
    };
  } catch {
    throw new UnauthorizedError('Invalid or expired Firebase token');
  }
}
