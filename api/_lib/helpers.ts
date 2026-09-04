// ==========================================
// API Helpers — Error classes & response utils
// ==========================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- Error Classes ---
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(400, message, details);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(401, message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden') {
    super(403, message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Not found') {
    super(404, message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, message);
    this.name = 'ConflictError';
  }
}

// --- Response Helpers ---
export function sendSuccess(res: VercelResponse, data: unknown, statusCode = 200) {
  return res.status(statusCode).json({ ok: true, data });
}

export function sendError(res: VercelResponse, error: unknown) {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      ok: false,
      error: error.message,
      details: error.details,
    });
  }

  console.error('Unhandled error:', error);
  return res.status(500).json({
    ok: false,
    error: 'Internal server error',
  });
}

// --- CORS ---
export function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Init-Data');
}

export function handleCors(req: VercelRequest, res: VercelResponse): boolean {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}
