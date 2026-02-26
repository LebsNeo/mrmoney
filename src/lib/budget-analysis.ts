/**
 * MrMoney — Budget Analysis
 * Phase 4: Budget vs Actual comparison and alerting
 */

import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { TransactionType, TransactionCategory } from "@prisma/client";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type BudgetStatus = "ON_TRACK" | "WARNING" | "OVER_BUDGET" | "UNDER_SPEND";

export interface BudgetVsActualItem {
  category: TransactionCategory;
  budgetedAmount: number;
  actualAmount: number;
  variance: number; // positive = under budget, negative = over budget
  variancePercent: number;
  status: BudgetStatus;
}

export interface BudgetAlert {
  propertyId: string;
  propertyName: string;
  category: TransactionCategory;
  budgetedAmount: number;
  actualAmount: number;
  variancePercent: number;
  status: "WARNING" | "OVER_BUDGET";
}

// ─────────────────────────────────────────────
// 1. BUDGET VS ACTUAL
// ─────────────────────────────────────────────

export async function getBudgetVsActual(
  propertyId: string,
  period: string // YYYY-MM
): Promise<BudgetVsActualItem[]> {
  const [year, month] = period.split("-").map(Number);
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);

  // All budget items for this property and period
  const budgetItems = await prisma.budgetItem.findMany({
    where: {
      propertyId,
      period,
      deletedAt: null,
    },
    select: {
      category: true,
      budgetedAmount: true,
    },
  });

  if (budgetItems.length === 0) {
    return [];
  }

  // Actual expense transactions for this period grouped by category
  const actuals = await prisma.transaction.groupBy({
    by: ["category"],
    where: {
      propertyId,
      type: TransactionType.EXPENSE,
      deletedAt: null,
      date: { gte: monthStart, lte: monthEnd },
    },
    _sum: { amount: true },
  });

  const actualByCategory = new Map<TransactionCategory, number>();
  for (const row of actuals) {
    actualByCategory.set(row.category, toNumber(row._sum.amount ?? 0));
  }

  const result: BudgetVsActualItem[] = [];

  for (const item of budgetItems) {
    const budgetedAmount = toNumber(item.budgetedAmount);
    const actualAmount = actualByCategory.get(item.category) ?? 0;
    const variance = budgetedAmount - actualAmount;
    const variancePercent =
      budgetedAmount > 0 ? (variance / budgetedAmount) * 100 : 0;

    let status: BudgetStatus;
    if (actualAmount > budgetedAmount) {
      status = "OVER_BUDGET";
    } else if (budgetedAmount > 0 && actualAmount / budgetedAmount > 0.8) {
      status = "WARNING";
    } else if (actualAmount === 0 && budgetedAmount > 0) {
      status = "UNDER_SPEND";
    } else {
      status = "ON_TRACK";
    }

    result.push({
      category: item.category,
      budgetedAmount: round2(budgetedAmount),
      actualAmount: round2(actualAmount),
      variance: round2(variance),
      variancePercent: round2(variancePercent),
      status,
    });
  }

  // Sort: OVER_BUDGET first, then WARNING, then ON_TRACK, then UNDER_SPEND
  const order: BudgetStatus[] = ["OVER_BUDGET", "WARNING", "ON_TRACK", "UNDER_SPEND"];
  result.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));

  return result;
}

// ─────────────────────────────────────────────
// 2. BUDGET ALERTS (ACROSS ALL PROPERTIES)
// ─────────────────────────────────────────────

export async function getBudgetAlerts(
  organisationId: string
): Promise<BudgetAlert[]> {
  const currentPeriod = format(new Date(), "yyyy-MM");

  // Get all properties in the org
  const properties = await prisma.property.findMany({
    where: { organisationId, deletedAt: null, isActive: true },
    select: { id: true, name: true },
  });

  const alerts: BudgetAlert[] = [];

  for (const property of properties) {
    const items = await getBudgetVsActual(property.id, currentPeriod);

    for (const item of items) {
      if (item.status === "OVER_BUDGET" || item.status === "WARNING") {
        alerts.push({
          propertyId: property.id,
          propertyName: property.name,
          category: item.category,
          budgetedAmount: item.budgetedAmount,
          actualAmount: item.actualAmount,
          variancePercent: item.variancePercent,
          status: item.status as "WARNING" | "OVER_BUDGET",
        });
      }
    }
  }

  // Sort by severity: OVER_BUDGET first, then WARNING, then by variance %
  alerts.sort((a, b) => {
    if (a.status === "OVER_BUDGET" && b.status !== "OVER_BUDGET") return -1;
    if (a.status !== "OVER_BUDGET" && b.status === "OVER_BUDGET") return 1;
    return a.variancePercent - b.variancePercent; // more over budget first
  });

  return alerts;
}

// ─────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
