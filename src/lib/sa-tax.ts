/**
 * MrCA — South African PAYE Tax Calculator
 * SARS 2025/2026 tax year (1 March 2025 – 28 February 2026)
 *
 * Implements:
 *  - Progressive income tax brackets
 *  - Primary, secondary, and tertiary rebates
 *  - Tax thresholds by age group
 *  - Monthly PAYE withholding
 *
 * Reference: SARS Tax Tables 2025/2026
 * https://www.sars.gov.za
 */

// ─── Tax brackets (annual) ───────────────────────────────────────────────────

interface TaxBracket {
  upTo: number;       // upper bound (inclusive)
  base: number;       // fixed tax on prior brackets
  rate: number;       // marginal rate on excess
  floor: number;      // lower bound (exclusive)
}

const TAX_BRACKETS_2025: TaxBracket[] = [
  { floor: 0,       upTo: 237_100,   base: 0,       rate: 0.18 },
  { floor: 237_100, upTo: 370_500,   base: 42_678,  rate: 0.26 },
  { floor: 370_500, upTo: 512_800,   base: 77_362,  rate: 0.31 },
  { floor: 512_800, upTo: 673_000,   base: 121_475, rate: 0.36 },
  { floor: 673_000, upTo: 857_900,   base: 179_147, rate: 0.39 },
  { floor: 857_900, upTo: 1_817_000, base: 251_258, rate: 0.41 },
  { floor: 1_817_000, upTo: Infinity, base: 644_489, rate: 0.45 },
];

// ─── Rebates ─────────────────────────────────────────────────────────────────

const PRIMARY_REBATE   = 17_235;   // All individuals
const SECONDARY_REBATE = 9_444;    // 65 years and older
const TERTIARY_REBATE  = 3_145;    // 75 years and older

// ─── Tax thresholds (below these, no tax is payable) ─────────────────────────

const THRESHOLD_UNDER_65 = 95_750;
const THRESHOLD_65_TO_74 = 148_217;
const THRESHOLD_75_PLUS  = 165_689;

// ─── UIF constants ───────────────────────────────────────────────────────────

export const UIF_RATE = 0.01;
export const UIF_CAP_MONTHLY = 17_712;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export type AgeGroup = "under65" | "65to74" | "75plus";

function getAgeGroup(dateOfBirth?: Date | null): AgeGroup {
  if (!dateOfBirth) return "under65"; // default — most hospitality workers
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const m = today.getMonth() - dateOfBirth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dateOfBirth.getDate())) age--;
  if (age >= 75) return "75plus";
  if (age >= 65) return "65to74";
  return "under65";
}

function getRebate(ageGroup: AgeGroup): number {
  switch (ageGroup) {
    case "75plus":  return PRIMARY_REBATE + SECONDARY_REBATE + TERTIARY_REBATE;
    case "65to74":  return PRIMARY_REBATE + SECONDARY_REBATE;
    default:        return PRIMARY_REBATE;
  }
}

function getThreshold(ageGroup: AgeGroup): number {
  switch (ageGroup) {
    case "75plus":  return THRESHOLD_75_PLUS;
    case "65to74":  return THRESHOLD_65_TO_74;
    default:        return THRESHOLD_UNDER_65;
  }
}

// ─── Annual tax calculation ──────────────────────────────────────────────────

/**
 * Calculate annual income tax from taxable income using SARS brackets.
 */
function calcAnnualTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;

  for (const bracket of TAX_BRACKETS_2025) {
    if (taxableIncome <= bracket.upTo) {
      return bracket.base + (taxableIncome - bracket.floor) * bracket.rate;
    }
  }
  // Above all brackets (shouldn't happen with Infinity upper)
  const last = TAX_BRACKETS_2025[TAX_BRACKETS_2025.length - 1];
  return last.base + (taxableIncome - last.floor) * last.rate;
}

// ─── Monthly PAYE calculation ────────────────────────────────────────────────

/**
 * Calculate monthly PAYE for an employee.
 *
 * @param monthlyGross  Total monthly remuneration (salary + overtime + bonus + tips)
 * @param ageGroup      Employee age group for rebate calculation
 * @returns Monthly PAYE amount (rounded to 2 decimal places, never negative)
 */
export function calcMonthlyPAYE(
  monthlyGross: number,
  ageGroup: AgeGroup = "under65"
): number {
  if (monthlyGross <= 0) return 0;

  // Annualise monthly income
  const annualIncome = monthlyGross * 12;

  // Check threshold — if below, no tax payable
  const threshold = getThreshold(ageGroup);
  if (annualIncome <= threshold) return 0;

  // Calculate annual tax
  const annualTax = calcAnnualTax(annualIncome);

  // Apply rebates
  const rebate = getRebate(ageGroup);
  const netTax = annualTax - rebate;

  // Monthly PAYE = annual / 12, never negative
  const monthlyPaye = Math.max(0, netTax / 12);
  return parseFloat(monthlyPaye.toFixed(2));
}

// ─── UIF calculation ─────────────────────────────────────────────────────────

/**
 * Calculate monthly UIF employee contribution.
 * Capped at UIF_CAP_MONTHLY × UIF_RATE.
 */
export function calcUIF(monthlyGross: number): number {
  return parseFloat((Math.min(monthlyGross, UIF_CAP_MONTHLY) * UIF_RATE).toFixed(2));
}

// ─── Net pay calculation ─────────────────────────────────────────────────────

/**
 * Calculate net pay after all deductions.
 */
export function calcNetPay(params: {
  grossPay: number;
  overtime: number;
  bonus: number;
  otherAdditions: number;
  paye: number;
  uifEmployee: number;
  otherDeductions: number;
}): number {
  const totalEarnings = params.grossPay + params.overtime + params.bonus + params.otherAdditions;
  const totalDeductions = params.paye + params.uifEmployee + params.otherDeductions;
  return parseFloat((totalEarnings - totalDeductions).toFixed(2));
}

// ─── BCEA Section 32 payslip itemisation ─────────────────────────────────────

export interface PayslipLineItem {
  description: string;
  amount: number;
  type: "earning" | "deduction" | "employer_contribution";
}

/**
 * Build itemised payslip lines for BCEA Section 32 compliance.
 */
export function buildPayslipItems(entry: {
  grossPay: number;
  overtime: number;
  bonus: number;
  otherAdditions: number;
  paye: number;
  uifEmployee: number;
  uifEmployer: number;
  otherDeductions: number;
}): { earnings: PayslipLineItem[]; deductions: PayslipLineItem[]; employerContributions: PayslipLineItem[] } {
  const earnings: PayslipLineItem[] = [
    { description: "Basic Salary", amount: entry.grossPay, type: "earning" },
  ];
  if (entry.overtime > 0) earnings.push({ description: "Overtime", amount: entry.overtime, type: "earning" });
  if (entry.bonus > 0) earnings.push({ description: "Bonus", amount: entry.bonus, type: "earning" });
  if (entry.otherAdditions > 0) earnings.push({ description: "Tips & Other Additions", amount: entry.otherAdditions, type: "earning" });

  const deductions: PayslipLineItem[] = [];
  if (entry.paye > 0) deductions.push({ description: "PAYE (Income Tax)", amount: entry.paye, type: "deduction" });
  deductions.push({ description: "UIF (Employee 1%)", amount: entry.uifEmployee, type: "deduction" });
  if (entry.otherDeductions > 0) deductions.push({ description: "Advance / Loan Deduction", amount: entry.otherDeductions, type: "deduction" });

  const employerContributions: PayslipLineItem[] = [
    { description: "UIF (Employer 1%)", amount: entry.uifEmployer, type: "employer_contribution" },
  ];

  return { earnings, deductions, employerContributions };
}
