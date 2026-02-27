"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TransactionCategory, TransactionSource, TransactionStatus } from "@prisma/client";
import { logger } from "@/lib/logger";

async function getOrgId() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organisationId?: string })?.organisationId;
  if (!orgId) throw new Error("Unauthorised");
  return orgId;
}

async function resolveProperty(orgId: string, propertyId?: string) {
  if (propertyId) return propertyId;
  const p = await prisma.property.findFirst({
    where: { organisationId: orgId, isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (!p) throw new Error("No active property found");
  return p.id;
}

export interface CreateExpenseInput {
  propertyId?: string;
  description: string;
  amount: number;          // positive number — stored as EXPENSE
  category: TransactionCategory;
  date: string;            // ISO date string YYYY-MM-DD
  vatRate?: number;        // e.g. 0.15 for 15%
  isVatInclusive?: boolean;
  notes?: string;
  receiptUrl?: string;     // Vercel Blob URL
  reference?: string;
}

export async function createExpense(input: CreateExpenseInput) {
  try {
    const orgId = await getOrgId();
    const propertyId = await resolveProperty(orgId, input.propertyId);

    if (!input.description?.trim()) return { success: false, message: "Description is required" };
    if (!input.amount || input.amount <= 0) return { success: false, message: "Amount must be greater than 0" };

    const vatRate = input.vatRate ?? 0;
    const isVatInclusive = input.isVatInclusive ?? false;
    let amount = input.amount;
    let vatAmount = 0;

    if (vatRate > 0) {
      if (isVatInclusive) {
        // Extract VAT from inclusive amount
        vatAmount = amount - amount / (1 + vatRate);
      } else {
        // VAT on top
        vatAmount = amount * vatRate;
      }
    }

    const tx = await prisma.transaction.create({
      data: {
        organisationId: orgId,
        propertyId,
        type: "EXPENSE",
        source: TransactionSource.MANUAL,
        category: input.category,
        description: input.description.trim(),
        amount,
        currency: "ZAR",
        date: new Date(input.date),
        vatRate,
        vatAmount,
        isVatInclusive,
        status: TransactionStatus.CLEARED,
        notes: input.notes?.trim() || null,
        receiptUrl: input.receiptUrl || null,
        reference: input.reference?.trim() || null,
      },
    });

    revalidatePath("/transactions");
    revalidatePath("/dashboard");

    logger.info("Expense created", { id: tx.id, amount, category: input.category });
    return { success: true, message: "Expense recorded", transactionId: tx.id };
  } catch (err) {
    logger.error("createExpense failed", err);
    return { success: false, message: "Failed to record expense" };
  }
}
