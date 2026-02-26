"use server";

import { prisma } from "@/lib/prisma";
import { getBudgetVsActual as _getBudgetVsActual, getBudgetAlerts as _getBudgetAlerts } from "@/lib/budget-analysis";
import { TransactionCategory } from "@prisma/client";
import { format, subMonths, startOfMonth } from "date-fns";

// ─────────────────────────────────────────────
// RE-EXPORTS (server action wrappers)
// ─────────────────────────────────────────────

export async function getBudgetVsActual(propertyId: string, period: string) {
  return _getBudgetVsActual(propertyId, period);
}

export async function getBudgetAlerts(organisationId: string) {
  return _getBudgetAlerts(organisationId);
}

// ─────────────────────────────────────────────
// UPSERT BUDGET ITEM
// ─────────────────────────────────────────────

export async function upsertBudgetItem(
  propertyId: string,
  category: TransactionCategory,
  period: string, // YYYY-MM
  amount: number
): Promise<void> {
  const existing = await prisma.budgetItem.findFirst({
    where: {
      propertyId,
      category,
      period,
      deletedAt: null,
    },
  });

  if (existing) {
    await prisma.budgetItem.update({
      where: { id: existing.id },
      data: { budgetedAmount: amount },
    });
  } else {
    await prisma.budgetItem.create({
      data: {
        propertyId,
        category,
        period,
        budgetedAmount: amount,
      },
    });
  }
}

// ─────────────────────────────────────────────
// COPY BUDGET FROM PREVIOUS MONTH
// ─────────────────────────────────────────────

export async function copyBudgetFromPreviousMonth(
  propertyId: string,
  fromPeriod: string, // YYYY-MM
  toPeriod: string    // YYYY-MM
): Promise<{ copied: number }> {
  const sourceItems = await prisma.budgetItem.findMany({
    where: {
      propertyId,
      period: fromPeriod,
      deletedAt: null,
    },
  });

  let copied = 0;

  for (const item of sourceItems) {
    await upsertBudgetItem(
      propertyId,
      item.category,
      toPeriod,
      parseFloat(item.budgetedAmount.toString())
    );
    copied++;
  }

  return { copied };
}

// ─────────────────────────────────────────────
// GET ALL BUDGET ITEMS FOR A PROPERTY + PERIOD
// ─────────────────────────────────────────────

export async function getBudgetItems(propertyId: string, period: string) {
  return prisma.budgetItem.findMany({
    where: { propertyId, period, deletedAt: null },
    orderBy: { category: "asc" },
  });
}

// ─────────────────────────────────────────────
// GET AVAILABLE PERIODS (current + next 3 months)
// ─────────────────────────────────────────────

export function getAvailablePeriods(): string[] {
  const now = new Date();
  const periods: string[] = [];
  for (let i = 0; i < 4; i++) {
    const d = startOfMonth(new Date(now.getFullYear(), now.getMonth() + i, 1));
    periods.push(format(d, "yyyy-MM"));
  }
  return periods;
}

export function getPreviousPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const d = subMonths(new Date(year, month - 1, 1), 1);
  return format(d, "yyyy-MM");
}
