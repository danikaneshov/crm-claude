// ==========================================
// CRM Hookah — Constants
// ==========================================

// Firestore collection names
export const COLLECTIONS = {
  EMPLOYEES: 'employees',
  LOCATIONS: 'locations',
  SHIFTS: 'shifts',
  SHIFT_CHANGES: 'shift_changes',
  REVISIONS: 'revisions',
  AUDIT_LOG: 'audit_log',
} as const;

// Shift statuses
export const SHIFT_STATUS = {
  OPEN: 'OPEN',
  PROCESSING: 'PROCESSING',
  CLOSED: 'CLOSED',
  CORRECTED: 'CORRECTED',
  ERROR: 'ERROR',
} as const;

// JWT
export const JWT_EXPIRY = '24h';

// Telegram initData max age (5 minutes)
export const INIT_DATA_MAX_AGE_SECONDS = 300;

// Audit actions
export const AUDIT_ACTIONS = {
  // Employee
  CREATE_EMPLOYEE: 'create_employee',
  UPDATE_EMPLOYEE: 'update_employee',
  DEACTIVATE_EMPLOYEE: 'deactivate_employee',
  LINK_TELEGRAM: 'link_telegram',

  // Shift
  OPEN_SHIFT: 'open_shift',
  CLOSE_SHIFT: 'close_shift',
  CORRECT_SHIFT: 'correct_shift',
  ERROR_SHIFT: 'error_shift',

  // Location
  CREATE_LOCATION: 'create_location',
  UPDATE_LOCATION: 'update_location',

  // Revision
  CREATE_REVISION: 'create_revision',
  UPDATE_REVISION: 'update_revision',
  FINALIZE_REVISION: 'finalize_revision',
} as const;
