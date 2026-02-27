/**
 * Chart of Accounts — MrMoney Hospitality Edition
 * Opinionated. Lean. Hardcoded for hospitality.
 * No accounting madness. Just outcomes.
 */

import { TransactionCategory, TransactionType } from "@prisma/client";

export type COAGroup =
  | "REVENUE"
  | "COST_OF_SALES"
  | "OPERATING_EXPENSES"
  | "FINANCIAL_CHARGES";

export interface COALine {
  category: TransactionCategory;
  label: string;
  group: COAGroup;
  /** When category is OTHER, type determines which group it falls under */
  typeOverride?: TransactionType;
}

/** Master COA definition — the single source of truth */
export const COA: COALine[] = [
  // ── REVENUE ─────────────────────────────────────
  { category: "ACCOMMODATION",  label: "Accommodation",     group: "REVENUE" },
  { category: "FB",             label: "Food & Beverage",   group: "REVENUE" },
  { category: "LAUNDRY",        label: "Laundry",           group: "REVENUE" },

  // ── COST OF SALES ────────────────────────────────
  { category: "OTA_COMMISSION", label: "OTA Commissions",   group: "COST_OF_SALES" },
  { category: "CLEANING",       label: "Cleaning Supplies", group: "COST_OF_SALES" },
  { category: "SUPPLIES",       label: "Guest Supplies",    group: "COST_OF_SALES" },

  // ── OPERATING EXPENSES ───────────────────────────
  { category: "SALARIES",       label: "Salaries & Wages",  group: "OPERATING_EXPENSES" },
  { category: "UTILITIES",      label: "Utilities",         group: "OPERATING_EXPENSES" },
  { category: "MAINTENANCE",    label: "Maintenance",       group: "OPERATING_EXPENSES" },
  { category: "MARKETING",      label: "Marketing",         group: "OPERATING_EXPENSES" },

  // ── FINANCIAL CHARGES ────────────────────────────
  { category: "LOAN_INTEREST",  label: "Loan Interest",     group: "FINANCIAL_CHARGES" },
  { category: "BANK_CHARGES",   label: "Bank Charges",      group: "FINANCIAL_CHARGES" },
];

/** Lookup: category → COA group (OTHER is resolved by transaction type at runtime) */
export const categoryToGroup: Partial<Record<TransactionCategory, COAGroup>> =
  Object.fromEntries(COA.map((c) => [c.category, c.group]));

/** Lookup: category → display label */
export const categoryLabel: Partial<Record<TransactionCategory, string>> =
  Object.fromEntries(COA.map((c) => [c.category, c.label]));

export const GROUP_META: Record<COAGroup, { label: string; sign: 1 | -1 }> = {
  REVENUE:            { label: "Revenue",            sign:  1 },
  COST_OF_SALES:      { label: "Cost of Sales",      sign: -1 },
  OPERATING_EXPENSES: { label: "Operating Expenses", sign: -1 },
  FINANCIAL_CHARGES:  { label: "Financial Charges",  sign: -1 },
};

/** Resolve which COA group a transaction belongs to */
export function resolveGroup(
  category: TransactionCategory,
  type: TransactionType
): COAGroup {
  if (category === "OTHER" || category === "VAT_OUTPUT" || category === "VAT_INPUT") {
    return type === "INCOME" ? "REVENUE" : "OPERATING_EXPENSES";
  }
  return categoryToGroup[category] ?? "OPERATING_EXPENSES";
}

/** Display label for a category (with OTHER resolved by type) */
export function resolveLabel(
  category: TransactionCategory,
  type: TransactionType
): string {
  if (category === "OTHER") return type === "INCOME" ? "Other Revenue" : "Other Expenses";
  if (category === "VAT_OUTPUT") return "VAT Output";
  if (category === "VAT_INPUT")  return "VAT Input";
  return categoryLabel[category] ?? category;
}
