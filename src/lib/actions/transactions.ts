"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { TransactionType, TransactionCategory, TransactionStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export interface TransactionFilters {
  type?: TransactionType;
  category?: TransactionCategory;
  status?: TransactionStatus;
  propertyId?: string;
  organisationId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

function buildWhere(filters: TransactionFilters) {
  const { type, category, status, propertyId, organisationId, dateFrom, dateTo } = filters;
  return {
    deletedAt: null,
    ...(type && { type }),
    ...(category && { category }),
    ...(status && { status }),
    ...(propertyId && { propertyId }),
    ...(organisationId && { organisationId }),
    ...(dateFrom || dateTo
      ? {
          date: {
            ...(dateFrom && { gte: new Date(dateFrom) }),
            ...(dateTo && { lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999)) }),
          },
        }
      : {}),
  };
}

export async function getTransactions(filters: TransactionFilters = {}) {
  const { page = 1, limit = 20 } = filters;
  const skip = (page - 1) * limit;
  const where = buildWhere(filters);

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        property: { select: { name: true } },
        vendor: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      skip,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    transactions,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getTransactionSummary(filters: TransactionFilters = {}) {
  const where = buildWhere(filters);

  const [income, expenses] = await Promise.all([
    prisma.transaction.aggregate({
      where: { ...where, type: "INCOME" },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { ...where, type: "EXPENSE" },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const totalIncome = Number(income._sum.amount ?? 0);
  const totalExpenses = Number(expenses._sum.amount ?? 0);

  return {
    totalIncome,
    totalExpenses,
    net: totalIncome - totalExpenses,
    incomeCount: income._count,
    expenseCount: expenses._count,
  };
}

export async function updateTransactionCategory(
  id: string,
  category: TransactionCategory
): Promise<void> {
  await prisma.transaction.update({
    where: { id },
    data: { category },
  });
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/reports/pl");
}

export async function deleteTransaction(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    const orgId = (session?.user as { organisationId?: string })?.organisationId;
    if (!orgId) return { ok: false, error: "Unauthorized" };

    await prisma.transaction.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    revalidatePath("/transactions");
    revalidatePath("/dashboard");
    revalidatePath("/reports/pl");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to delete transaction" };
  }
}

export async function deleteTransactions(ids: string[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    const orgId = (session?.user as { organisationId?: string })?.organisationId;
    if (!orgId) return { ok: false, error: "Unauthorized" };

    await prisma.transaction.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: new Date() },
    });
    revalidatePath("/transactions");
    revalidatePath("/dashboard");
    revalidatePath("/reports/pl");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to delete transactions" };
  }
}
