/**
 * Chart of Accounts — Hospitality Edition
 * Opinionated, lean, no accounting madness.
 * Maps TransactionCategory → COA groups → Financial Statements
 */
import { TransactionCategory, TransactionType } from "@prisma/client";

// ─────────────────────────────────────────────
// COA Group Definitions
// ─────────────────────────────────────────────

export type COAGroup =
  | "REVENUE"
  | "COST_OF_SALES"
  | "OPERATING_EXPENSES"
  | "FINANCIAL_CHARGES"
  | "OTHER_INCOME"
  | "TAX";

export interface COALine {
  category: TransactionCategory;
  label: string;
  group: COAGroup;
  type: TransactionType; // expected transaction type
  sortOrder: number;
}

export const CHART_OF_ACCOUNTS: COALine[] = [
  // ── REVENUE ──────────────────────────────
  { category: "ACCOMMODATION",  label: "Accommodation",     group: "REVENUE",            type: "INCOME",  sortOrder: 10 },
  { category: "FB",             label: "Food & Beverage",   group: "REVENUE",            type: "INCOME",  sortOrder: 11 },
  { category: "LAUNDRY",        label: "Laundry",           group: "REVENUE",            type: "INCOME",  sortOrder: 12 },
  { category: "OTHER",          label: "Other Income",      group: "REVENUE",            type: "INCOME",  sortOrder: 19 },

  // ── COST OF SALES ────────────────────────
  { category: "OTA_COMMISSION", label: "OTA Commissions",   group: "COST_OF_SALES",      type: "EXPENSE", sortOrder: 30 },
  { category: "CLEANING",       label: "Cleaning",          group: "COST_OF_SALES",      type: "EXPENSE", sortOrder: 31 },
  { category: "SUPPLIES",       label: "Guest Supplies",    group: "COST_OF_SALES",      type: "EXPENSE", sortOrder: 32 },

  // ── OPERATING EXPENSES ───────────────────
  { category: "SALARIES",       label: "Salaries & Wages",  group: "OPERATING_EXPENSES", type: "EXPENSE", sortOrder: 50 },
  { category: "UTILITIES",      label: "Utilities",         group: "OPERATING_EXPENSES", type: "EXPENSE", sortOrder: 51 },
  { category: "MAINTENANCE",    label: "Maintenance",       group: "OPERATING_EXPENSES", type: "EXPENSE", sortOrder: 52 },
  { category: "MARKETING",      label: "Marketing",         group: "OPERATING_EXPENSES", type: "EXPENSE", sortOrder: 53 },
  { category: "OTHER",          label: "Other Expenses",    group: "OPERATING_EXPENSES", type: "EXPENSE", sortOrder: 59 },

  // ── FINANCIAL CHARGES ────────────────────
  { category: "LOAN_INTEREST",  label: "Loan Interest",     group: "FINANCIAL_CHARGES",  type: "EXPENSE", sortOrder: 70 },
  { category: "BANK_CHARGES",   label: "Bank Charges",      group: "FINANCIAL_CHARGES",  type: "EXPENSE", sortOrder: 71 },

  // ── TAX ──────────────────────────────────
  { category: "VAT_OUTPUT",     label: "VAT Output",        group: "TAX",                type: "INCOME",  sortOrder: 90 },
  { category: "VAT_INPUT",      label: "VAT Input",         group: "TAX",                type: "EXPENSE", sortOrder: 91 },
];

// Fast lookup by category + type
export function getCOALine(
  category: TransactionCategory,
  type: TransactionType
): COALine | undefined {
  return CHART_OF_ACCOUNTS.find(
    (l) => l.category === category && l.type === type
  );
}

// ─────────────────────────────────────────────
// P&L Structure
// ─────────────────────────────────────────────

export interface PLLineItem {
  category: TransactionCategory;
  label: string;
  amount: number;
}

export interface PLSection {
  group: COAGroup;
  title: string;
  lines: PLLineItem[];
  total: number;
}

export interface PLStatement {
  propertyName: string;
  periodLabel: string;
  from: Date;
  to: Date;
  generatedAt: Date;
  currency: string;

  revenue: PLSection;
  costOfSales: PLSection;
  grossProfit: number;
  grossMargin: number; // %

  operatingExpenses: PLSection;
  ebitda: number;
  ebitdaMargin: number; // %

  financialCharges: PLSection;
  netProfit: number;
  netMargin: number; // %

  totalRevenue: number;
  totalExpenses: number;
}

// ─────────────────────────────────────────────
// COA group metadata (for UI display)
// ─────────────────────────────────────────────

export const COA_GROUP_META: Record<COAGroup, { title: string; color: string }> = {
  REVENUE:            { title: "Revenue",            color: "emerald" },
  COST_OF_SALES:      { title: "Cost of Sales",      color: "amber"   },
  OPERATING_EXPENSES: { title: "Operating Expenses", color: "red"     },
  FINANCIAL_CHARGES:  { title: "Financial Charges",  color: "orange"  },
  OTHER_INCOME:       { title: "Other Income",        color: "blue"    },
  TAX:                { title: "Tax",                 color: "gray"    },
};
