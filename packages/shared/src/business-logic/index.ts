// ==========================================
// CRM Hookah — Business Logic
// ==========================================

import type { LocationSalaryRules } from '../types/index.js';

// --- Constants ---
export const SHIFT_COEFFICIENTS = {
  FIRST_MASTER: 1.0,
  SECOND_MASTER: 0.5,
} as const;

export const ANOMALY_THRESHOLDS = {
  MAX_HOOKAHS_PER_SHIFT: 50,
  MAX_REPLACEMENTS_PER_SHIFT: 50,
  MAX_TOTAL_SALES: 80,
} as const;

// --- Sales Distribution ---

export interface SalesDistribution {
  firstMasterSales: number;
  secondMasterSales: number;
}

/**
 * Распределяет продажи между мастерами.
 * Остаток всегда получает первый мастер.
 *
 * Пример: 9 продаж → первый=5, второй=4
 */
export function distributeSales(totalSales: number, hasTwoMasters: boolean): SalesDistribution {
  if (!hasTwoMasters) {
    return { firstMasterSales: totalSales, secondMasterSales: 0 };
  }

  const secondMasterSales = Math.floor(totalSales / 2);
  const firstMasterSales = totalSales - secondMasterSales;

  return { firstMasterSales, secondMasterSales };
}

// --- Salary Calculation ---

export interface SalaryInput {
  sales: number;
  salaryBase: number;
  salaryPerSale: number;
  isSecondMaster: boolean;
  locationRules: LocationSalaryRules;
}

/**
 * Рассчитывает зарплату мастера за смену.
 *
 * Правила:
 * - Первый мастер: полный оклад + продажи × ставка
 * - Второй мастер: половина оклада + продажи × ставка
 * - Если location_rules.no_base_on_zero_sales && продажи === 0 → оклад не выплачивается
 * - Location может переопределять salary_per_sale и salary_base
 */
export function calculateSalary(input: SalaryInput): number {
  const { sales, isSecondMaster, locationRules } = input;

  // Использовать override из location если задан, иначе из профиля сотрудника
  const effectiveBase = locationRules.salary_base_override ?? input.salaryBase;
  const effectivePerSale = locationRules.salary_per_sale_override ?? input.salaryPerSale;

  // Для второго мастера оклад делится пополам
  const base = isSecondMaster ? Math.floor(effectiveBase / 2) : effectiveBase;

  // Правило: на некоторых точках при 0 продажах оклад не выплачивается
  if (locationRules.no_base_on_zero_sales && sales === 0) {
    return 0;
  }

  return base + (sales * effectivePerSale);
}

/**
 * Полный расчёт для смены: распределение + зарплата обоих мастеров.
 */
export interface ShiftCalculationInput {
  hookahs: number;
  replacements: number;
  firstMasterSalaryBase: number;
  firstMasterSalaryPerSale: number;
  secondMasterSalaryBase: number | null;
  secondMasterSalaryPerSale: number | null;
  hasTwoMasters: boolean;
  locationRules: LocationSalaryRules;
}

export interface ShiftCalculationResult {
  totalSales: number;
  firstMasterSales: number;
  secondMasterSales: number;
  firstMasterSalary: number;
  secondMasterSalary: number | null;
}

export function calculateShiftResults(input: ShiftCalculationInput): ShiftCalculationResult {
  const totalSales = input.hookahs + input.replacements;
  const { firstMasterSales, secondMasterSales } = distributeSales(totalSales, input.hasTwoMasters);

  const firstMasterSalary = calculateSalary({
    sales: firstMasterSales,
    salaryBase: input.firstMasterSalaryBase,
    salaryPerSale: input.firstMasterSalaryPerSale,
    isSecondMaster: false,
    locationRules: input.locationRules,
  });

  let secondMasterSalary: number | null = null;
  if (input.hasTwoMasters && input.secondMasterSalaryBase !== null && input.secondMasterSalaryPerSale !== null) {
    secondMasterSalary = calculateSalary({
      sales: secondMasterSales,
      salaryBase: input.secondMasterSalaryBase,
      salaryPerSale: input.secondMasterSalaryPerSale,
      isSecondMaster: true,
      locationRules: input.locationRules,
    });
  }

  return {
    totalSales,
    firstMasterSales,
    secondMasterSales,
    firstMasterSalary,
    secondMasterSalary,
  };
}

// --- Anomaly Detection ---

export interface AnomalyCheckResult {
  isAnomalous: boolean;
  reason: string | null;
}

/**
 * Проверяет результат AI на аномалии.
 * Если за одну смену AI определил слишком много продаж — помечает как подозрительный.
 */
export function checkAnomaly(hookahs: number, replacements: number): AnomalyCheckResult {
  if (hookahs < 0 || replacements < 0) {
    return { isAnomalous: true, reason: 'Отрицательные значения' };
  }

  if (hookahs > ANOMALY_THRESHOLDS.MAX_HOOKAHS_PER_SHIFT) {
    return {
      isAnomalous: true,
      reason: `Кальянов (${hookahs}) больше порога (${ANOMALY_THRESHOLDS.MAX_HOOKAHS_PER_SHIFT})`,
    };
  }

  if (replacements > ANOMALY_THRESHOLDS.MAX_REPLACEMENTS_PER_SHIFT) {
    return {
      isAnomalous: true,
      reason: `Замен (${replacements}) больше порога (${ANOMALY_THRESHOLDS.MAX_REPLACEMENTS_PER_SHIFT})`,
    };
  }

  const total = hookahs + replacements;
  if (total > ANOMALY_THRESHOLDS.MAX_TOTAL_SALES) {
    return {
      isAnomalous: true,
      reason: `Общие продажи (${total}) больше порога (${ANOMALY_THRESHOLDS.MAX_TOTAL_SALES})`,
    };
  }

  return { isAnomalous: false, reason: null };
}

// --- Revision Calculation ---

export interface RevisionCalculationInput {
  shouldBe: number;
  actuallyAvailable: number;
  totalLocationShifts: number;
  employeeShifts: number;  // full + half * 0.5
}

/**
 * Рассчитывает результат ревизии для мастера.
 *
 * Формула:
 * revision_difference = ((should_be - actually_available) / total_shifts) × employee_shifts
 */
export function calculateRevisionDifference(input: RevisionCalculationInput): number {
  if (input.totalLocationShifts === 0) return 0;

  const totalDifference = input.shouldBe - input.actuallyAvailable;
  return (totalDifference / input.totalLocationShifts) * input.employeeShifts;
}

/**
 * Рассчитывает количество смен мастера (с учётом коэффициентов).
 *
 * Полная смена = 1.0
 * Смена вторым мастером = 0.5
 */
export function calculateEmployeeShifts(fullShifts: number, halfShifts: number): number {
  return fullShifts + (halfShifts * SHIFT_COEFFICIENTS.SECOND_MASTER);
}
