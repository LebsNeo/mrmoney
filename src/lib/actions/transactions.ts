"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { TransactionType, TransactionCategory, TransactionStatus } from "@prisma/client";

export interface TransactionFilters {
  type?: TransactionType;
  category?: TransactionCategory;
  status?: TransactionStatus;
  propertyId?: string;
  organisationId?: string;
  page?: number;
  limit?: number;
}

export async function getTransactions(filters: TransactionFilters = {}) {
  const {
    type,
    category,
    status,
    propertyId,
    organisationId,
    page = 1,
    limit = 20,
  } = filters;

  const skip = (page - 1) * limit;

  const where = {
    deletedAt: null,
    ...(type && { type }),
    ...(category && { category }),
    ...(status && { status }),
    ...(propertyId && { propertyId }),
    ...(organisationId && { organisationId }),
  };

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
