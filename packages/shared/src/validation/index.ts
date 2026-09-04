// ==========================================
// CRM Hookah — Zod Validation Schemas
// ==========================================

import { z } from 'zod';

// --- Employee ---
export const employeeCreateSchema = z.object({
  name: z.string().min(1, 'Имя обязательно').max(100),
  telegram_id: z.number().int().positive().nullable(),
  salary_base: z.number().int().min(0, 'Оклад не может быть отрицательным'),
  salary_per_sale: z.number().int().min(0, 'Ставка не может быть отрицательной'),
  is_active: z.boolean().default(true),
  location_ids: z.array(z.string()).default([]),
  status: z.enum(['active', 'pending_link', 'deactivated']).default('active'),
});

export const employeeUpdateSchema = employeeCreateSchema.partial();

// --- Location ---
export const rkeeperMappingSchema = z.object({
  hookah_name: z.string().min(1, 'Название позиции кальяна обязательно'),
  replacement_name: z.string().min(1, 'Название позиции замены обязательно'),
});

export const locationSalaryRulesSchema = z.object({
  no_base_on_zero_sales: z.boolean().default(false),
  salary_per_sale_override: z.number().int().min(0).nullable().default(null),
  salary_base_override: z.number().int().min(0).nullable().default(null),
});

export const locationCreateSchema = z.object({
  name: z.string().min(1, 'Название точки обязательно').max(100),
  is_active: z.boolean().default(true),
  rkeeper_mapping: rkeeperMappingSchema,
  salary_rules: locationSalaryRulesSchema,
});

export const locationUpdateSchema = locationCreateSchema.partial();

// --- Shift ---
export const shiftOpenSchema = z.object({
  location_id: z.string().min(1, 'ID точки обязателен'),
  second_master_id: z.string().nullable().optional(),
});

export const shiftCorrectSchema = z.object({
  final_hookahs: z.number().int().min(0, 'Кальяны не могут быть отрицательными'),
  final_replacements: z.number().int().min(0, 'Замены не могут быть отрицательными'),
});

// --- Revision ---
export const revisionCreateSchema = z.object({
  location_id: z.string().min(1),
  period_year: z.number().int().min(2020).max(2100),
  period_month: z.number().int().min(1).max(12),
  should_be: z.number().int().min(0),
  actually_available: z.number().int().min(0),
});

export const revisionUpdateSchema = z.object({
  should_be: z.number().int().min(0).optional(),
  actually_available: z.number().int().min(0).optional(),
  status: z.enum(['draft', 'finalized']).optional(),
});

// --- AI Result ---
export const aiResultSchema = z.object({
  hookahs: z.number().int().nullable(),
  replacements: z.number().int().nullable(),
  confidence: z.number().min(0).max(1).optional(),
});

// --- Auth ---
export const telegramAuthSchema = z.object({
  initData: z.string().min(1),
});

// --- Query Params ---
export const salaryQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const dashboardQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  location_id: z.string().optional(),
  employee_id: z.string().optional(),
});

export const shiftsQuerySchema = z.object({
  year: z.coerce.number().int().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  location_id: z.string().optional(),
  employee_id: z.string().optional(),
  status: z.enum(['OPEN', 'PROCESSING', 'CLOSED', 'CORRECTED', 'ERROR']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const auditQuerySchema = z.object({
  entity_type: z.enum(['employee', 'shift', 'revision', 'location']).optional(),
  entity_id: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
