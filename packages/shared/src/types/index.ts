// ==========================================
// CRM Hookah — Core Types
// ==========================================

// --- Timestamps ---
// Firestore Timestamp type alias
export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
}

// --- Employee ---
export type EmployeeStatus = 'active' | 'pending_link' | 'deactivated';

export interface Employee {
  id: string;
  name: string;
  telegram_id: number | null;
  salary_base: number;        // Оклад за полную смену (₸)
  salary_per_sale: number;    // Ставка за продажу (₸)
  is_active: boolean;
  location_ids: string[];     // Доступные точки
  status: EmployeeStatus;
  created_at: FirestoreTimestamp;
  updated_at: FirestoreTimestamp;
}

export type EmployeeCreateInput = Omit<Employee, 'id' | 'created_at' | 'updated_at'>;
export type EmployeeUpdateInput = Partial<Omit<Employee, 'id' | 'created_at' | 'updated_at'>>;

// --- Location ---

/**
 * Маппинг позиций r_keeper для конкретной точки.
 * На разных точках позиции могут называться по-разному.
 */
export interface RKeeperMapping {
  hookah_name: string;        // Например: "Дымный коктейль"
  replacement_name: string;   // Например: "Дымный коктейль 2"
}

/**
 * Правила расчёта зарплаты для конкретной точки.
 * На разных точках могут быть разные правила.
 */
export interface LocationSalaryRules {
  /**
   * Если true — при 0 продажах оклад не выплачивается.
   * Точка 2 имеет это правило.
   */
  no_base_on_zero_sales: boolean;

  /**
   * Переопределение ставки за продажу для этой точки (если отличается).
   * null = использовать ставку из профиля сотрудника.
   */
  salary_per_sale_override: number | null;

  /**
   * Переопределение оклада для этой точки (если отличается).
   * null = использовать оклад из профиля сотрудника.
   */
  salary_base_override: number | null;
}

export interface Location {
  id: string;
  name: string;
  is_active: boolean;
  rkeeper_mapping: RKeeperMapping;
  salary_rules: LocationSalaryRules;
  created_at: FirestoreTimestamp;
  updated_at: FirestoreTimestamp;
}

export type LocationCreateInput = Omit<Location, 'id' | 'created_at' | 'updated_at'>;
export type LocationUpdateInput = Partial<Omit<Location, 'id' | 'created_at' | 'updated_at'>>;

// --- Shift ---
export type ShiftStatus = 'OPEN' | 'PROCESSING' | 'CLOSED' | 'CORRECTED' | 'ERROR';

export interface Shift {
  id: string;
  location_id: string;

  // Masters
  first_master_id: string;
  second_master_id: string | null;

  // Coefficients
  first_master_shift_coefficient: number;   // 1.0
  second_master_shift_coefficient: number;  // 0.5 или 0

  // Time
  date: string;  // "2026-08-25" ISO date
  opened_at: FirestoreTimestamp;
  closed_at: FirestoreTimestamp | null;

  status: ShiftStatus;

  // AI results (from Gemini)
  ai_hookahs: number | null;
  ai_replacements: number | null;
  ai_confidence: number | null;
  ai_raw_response: string | null;

  // Final results (AI by default, admin can override)
  final_hookahs: number | null;
  final_replacements: number | null;

  // Calculated
  total_sales: number | null;
  first_master_sales: number | null;
  second_master_sales: number | null;
  first_master_salary: number | null;
  second_master_salary: number | null;

  // Snapshots of rates at shift creation time (for historical accuracy)
  first_master_salary_base_snapshot: number;
  first_master_salary_per_sale_snapshot: number;
  second_master_salary_base_snapshot: number | null;
  second_master_salary_per_sale_snapshot: number | null;

  // Location salary rules snapshot
  location_salary_rules_snapshot: LocationSalaryRules;

  // Report photo (Telegram storage)
  report_storage: 'telegram' | null;
  telegram_chat_id: number | null;
  telegram_message_id: number | null;
  telegram_file_id: string | null;
  telegram_file_unique_id: string | null;

  // Anomaly flags
  is_anomalous: boolean;
  anomaly_reason: string | null;

  created_at: FirestoreTimestamp;
  updated_at: FirestoreTimestamp;
}

export interface ShiftOpenInput {
  location_id: string;
  second_master_id?: string | null;
}

// --- Shift Changes (Audit for shifts) ---
export interface ShiftChange {
  id: string;
  shift_id: string;
  admin_id: string;
  admin_email: string;
  field: string;
  old_value: unknown;
  new_value: unknown;
  created_at: FirestoreTimestamp;
}

// --- Revision ---
export type RevisionStatus = 'draft' | 'finalized';

export interface Revision {
  id: string;
  location_id: string;
  period_year: number;
  period_month: number;     // 1-12
  should_be: number;        // Сколько должно быть
  actually_available: number; // Сколько есть
  total_location_shifts: number;
  status: RevisionStatus;
  created_at: FirestoreTimestamp;
  updated_at: FirestoreTimestamp;
}

export interface RevisionCreateInput {
  location_id: string;
  period_year: number;
  period_month: number;
  should_be: number;
  actually_available: number;
}

export interface RevisionEmployeeResult {
  employee_id: string;
  employee_name: string;
  full_shifts: number;
  half_shifts: number;
  employee_shifts: number;   // full + half * 0.5
  revision_difference: number;
}

// --- Audit Log ---
export type ActorType = 'admin' | 'system';
export type EntityType = 'employee' | 'shift' | 'revision' | 'location';

export interface AuditLogEntry {
  id: string;
  actor_type: ActorType;
  actor_id: string;
  actor_email?: string;
  action: string;
  entity_type: EntityType;
  entity_id: string;
  changes: AuditChange[];
  created_at: FirestoreTimestamp;
}

export interface AuditChange {
  field: string;
  old_value: unknown;
  new_value: unknown;
}

// --- AI Result ---
export interface AIResult {
  hookahs: number | null;
  replacements: number | null;
  confidence?: number;
}

// --- Salary Summary ---
export interface SalarySummary {
  year: number;
  month: number;
  total_earned: number;
  total_shifts: number;
  full_shifts: number;
  half_shifts: number;
  total_hookahs: number;
  total_replacements: number;
  shifts: ShiftSalaryItem[];
}

export interface ShiftSalaryItem {
  shift_id: string;
  date: string;
  location_name: string;
  hookahs: number;
  replacements: number;
  total_sales: number;
  salary: number;
  is_second_master: boolean;
}

// --- Dashboard ---
export interface DashboardStats {
  total_hookahs: number;
  total_replacements: number;
  total_sales: number;
  total_shifts: number;
  active_masters: number;
  total_salary_fund: number;
}

export interface DashboardFilters {
  year: number;
  month: number;
  location_id?: string;
  employee_id?: string;
}

// --- Auth ---
export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface AuthResponse {
  token: string;
  employee: {
    id: string;
    name: string;
    location_ids: string[];
  };
}

export interface JWTPayload {
  employee_id: string;
  telegram_id: number;
  iat: number;
  exp: number;
}
