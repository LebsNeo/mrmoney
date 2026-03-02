/**
 * MrCA — Recurring Expense Detection
 * Detects, stores, and tracks recurring expenses
 */

import { TransactionCategory } from "@prisma/client";
import { prisma } from "./prisma";
import { addMonths, startOfMonth, endOfMonth, subDays } from "date-fns";

export interface DetectedRecurring {
  vendorId: string | null;
  descriptionKey: string;
  category: TransactionCategory;
  avgAmount: number;
  frequency: "MONTHLY" | "WEEKLY";
  lastDate: Date;
  nextExpectedDate: Date;
  transactionCount: number;
}

// ─────────────────────────────────────────────
// detectRecurringExpenses
// ─────────────────────────────────────────────

export async function detectRecurringExpenses(
  propertyId: string
): Promise<DetectedRecurring[]> {
  const ninetyDaysAgo = subDays(new Date(), 90);

  const expenses = await prisma.transaction.findMany({
    where: {
      propertyId,
      type: "EXPENSE",
      deletedAt: null,
      date: { gte: ninetyDaysAgo },
    },
    select: {
      id: true,
      vendorId: true,
      description: true,
      amount: true,
      category: true,
      date: true,
    },
    orderBy: { date: "asc" },
  });

  // Group by vendorId or description key
  const groups = new Map<
    string,
    {
      vendorId: string | null;
      category: TransactionCategory;
      entries: { amount: number; date: Date; monthKey: string }[];
    }
  >();

  for (const tx of expenses) {
    const key = tx.vendorId ?? `desc:${tx.description.slice(0, 40).toLowerCase().trim()}`;
    const existing = groups.get(key);
    const monthKey = `${new Date(tx.date).getFullYear()}-${String(new Date(tx.date).getMonth() + 1).padStart(2, "0")}`;
    if (existing) {
      existing.entries.push({
        amount: parseFloat(tx.amount.toString()),
        date: new Date(tx.date),
        monthKey,
      });
    } else {
      groups.set(key, {
        vendorId: tx.vendorId,
        category: tx.category,
        entries: [{ amount: parseFloat(tx.amount.toString()), date: new Date(tx.date), monthKey }],
      });
    }
  }

  const recurring: DetectedRecurring[] = [];

  for (const [key, group] of groups) {
    // Group entries by month
    const byMonth = new Map<string, number[]>();
    for (const entry of group.entries) {
      const existing = byMonth.get(entry.monthKey) ?? [];
      existing.push(entry.amount);
      byMonth.set(entry.monthKey, existing);
    }

    const monthKeys = Array.from(byMonth.keys()).sort();

    // Need at least 2 distinct months
    if (monthKeys.length < 2) continue;

    // Check consecutive months
    let consecutiveCount = 1;
    for (let i = 1; i < monthKeys.length; i++) {
      const prev = monthKeys[i - 1].split("-").map(Number);
      const curr = monthKeys[i].split("-").map(Number);
      const prevDate = new Date(prev[0], prev[1] - 1, 1);
      const currDate = new Date(curr[0], curr[1] - 1, 1);
      const diffMonths =
        (currDate.getFullYear() - prevDate.getFullYear()) * 12 +
        currDate.getMonth() -
        prevDate.getMonth();
      if (diffMonths === 1) {
        consecutiveCount++;
      }
    }

    if (consecutiveCount < 2) continue;

    // Check amount variance < 30%
    const allAmounts: number[] = [];
    for (const amounts of byMonth.values()) {
      const monthAvg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      allAmounts.push(monthAvg);
    }

    const avg = allAmounts.reduce((a, b) => a + b, 0) / allAmounts.length;
    const maxVariance = Math.max(...allAmounts.map((a) => Math.abs(a - avg) / avg));

    if (maxVariance >= 0.3) continue;

    // Find last transaction date
    const lastEntry = group.entries[group.entries.length - 1];

    // Calculate next expected date (next month same day)
    const nextExpected = addMonths(lastEntry.date, 1);

    recurring.push({
      vendorId: group.vendorId,
      descriptionKey: key,
      category: group.category,
      avgAmount: avg,
      frequency: "MONTHLY",
      lastDate: lastEntry.date,
      nextExpectedDate: nextExpected,
      transactionCount: group.entries.length,
    });
  }

  return recurring;
}

// ─────────────────────────────────────────────
// getOverdueRecurring
// ─────────────────────────────────────────────

export async function getOverdueRecurring(propertyId: string) {
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const overdueRecurring = await prisma.recurringExpense.findMany({
    where: {
      propertyId,
      isActive: true,
      deletedAt: null,
      nextExpectedDate: { lt: today },
    },
    include: {
      vendor: { select: { id: true, name: true } },
    },
  });

  // Filter out those that already have a matching transaction this month
  const result = [];
  for (const re of overdueRecurring) {
    const hasTransaction = await prisma.transaction.findFirst({
      where: {
        propertyId,
        type: "EXPENSE",
        deletedAt: null,
        date: { gte: monthStart, lte: monthEnd },
        ...(re.vendorId
          ? { vendorId: re.vendorId }
          : { category: re.category }),
        amount: {
          gte: parseFloat(re.avgAmount.toString()) * (1 - parseFloat(re.tolerancePercent.toString()) / 100),
          lte: parseFloat(re.avgAmount.toString()) * (1 + parseFloat(re.tolerancePercent.toString()) / 100),
        },
      },
      select: { id: true },
    });

    if (!hasTransaction) {
      result.push(re);
    }
  }

  return result;
}

// ─────────────────────────────────────────────
// syncRecurringExpenses
// ─────────────────────────────────────────────

export async function syncRecurringExpenses(propertyId: string): Promise<void> {
  const detected = await detectRecurringExpenses(propertyId);

  for (const item of detected) {
    // Find existing recurring expense
    const existing = await prisma.recurringExpense.findFirst({
      where: {
        propertyId,
        deletedAt: null,
        ...(item.vendorId
          ? { vendorId: item.vendorId }
          : { category: item.category }),
      },
    });

    if (existing) {
      await prisma.recurringExpense.update({
        where: { id: existing.id },
        data: {
          avgAmount: item.avgAmount,
          lastDetectedDate: item.lastDate,
          nextExpectedDate: item.nextExpectedDate,
          category: item.category,
          frequency: item.frequency,
        },
      });
    } else {
      await prisma.recurringExpense.create({
        data: {
          propertyId,
          vendorId: item.vendorId,
          category: item.category,
          avgAmount: item.avgAmount,
          tolerancePercent: 20,
          frequency: item.frequency,
          lastDetectedDate: item.lastDate,
          nextExpectedDate: item.nextExpectedDate,
          isActive: true,
        },
      });
    }
  }
}
