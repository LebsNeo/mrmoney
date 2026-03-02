"use server";

/**
 * MrCA — Automation Server Actions
 * Bank import, QB import, recurring expenses, alerts, digest
 */

import { prisma } from "@/lib/prisma";
import { parseBankStatementCSV } from "@/lib/bank-import";
import { parseQuickBooksCSV } from "@/lib/quickbooks-import";
import {
  syncRecurringExpenses as syncRecurring,
} from "@/lib/recurring";
import { generateAlerts } from "@/lib/alerts";
import { generateDailyDigest } from "@/lib/digest";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { TransactionCategory } from "@prisma/client";

// ─────────────────────────────────────────────
// Auth helper
// ─────────────────────────────────────────────

async function getOrgId(): Promise<string> {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organisationId?: string })?.organisationId;
  if (!orgId) throw new Error("Unauthorised");
  return orgId;
}

async function resolvePropertyId(orgId: string, rawId: string): Promise<string> {
  if (rawId && rawId !== "default") return rawId;
  const prop = await prisma.property.findFirst({
    where: { organisationId: orgId, isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (!prop) throw new Error("No active property found");
  return prop.id;
}

// ─────────────────────────────────────────────
// importBankTransactions
// ─────────────────────────────────────────────

export async function importBankTransactions(formData: FormData) {
  const orgId = await getOrgId();

  const bankFormat = formData.get("bankFormat") as string;
  const propertyId = formData.get("propertyId") as string;
  const file = formData.get("file") as File;
  // categories may be JSON-overridden per row
  const categoriesJson = formData.get("categories") as string | null;

  if (!bankFormat || !file) {
    throw new Error("Missing required fields: bankFormat, file");
  }

  const resolvedPropertyId = await resolvePropertyId(orgId, propertyId ?? "default");
  const csvContent = await file.text();
  const result = bankFormat.toUpperCase() === "QUICKBOOKS"
    ? await parseQuickBooksCSV(csvContent, resolvedPropertyId, orgId)
    : await parseBankStatementCSV(csvContent, bankFormat, resolvedPropertyId, orgId);

  // Parse category overrides if provided
  let categoryOverrides: Record<number, TransactionCategory> = {};
  if (categoriesJson) {
    try {
      categoryOverrides = JSON.parse(categoriesJson);
    } catch {}
  }

  // Bulk insert — apply any per-row category overrides then createMany
  const rows = result.transactions.map((tx, i) => ({
    organisationId: orgId,
    propertyId: resolvedPropertyId,
    type: tx.type,
    source: "CSV_IMPORT" as const,
    category: categoryOverrides[i] ?? tx.category,
    amount: tx.amount,
    currency: "ZAR",
    date: tx.date,
    description: tx.description,
    status: "CLEARED" as const,
    vatAmount: 0,
    vatRate: 0,
    isVatInclusive: false,
  }));

  const { count: saved } = await prisma.transaction.createMany({ data: rows });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");

  return {
    saved,
    duplicates: result.potentialDuplicates.length,
    unrecognised: result.unrecognised.length,
  };
}

// ─────────────────────────────────────────────
// importQuickBooksTransactions
// ─────────────────────────────────────────────

export async function importQuickBooksTransactions(formData: FormData) {
  const orgId = await getOrgId();

  const rawPropertyId = formData.get("propertyId") as string;
  const file = formData.get("file") as File;
  const categoriesJson = formData.get("categories") as string | null;

  if (!file) {
    throw new Error("Missing required field: file");
  }

  const resolvedPropertyId = await resolvePropertyId(orgId, rawPropertyId ?? "default");
  const csvContent = await file.text();
  const result = await parseQuickBooksCSV(csvContent, resolvedPropertyId, orgId);

  let categoryOverrides: Record<number, TransactionCategory> = {};
  if (categoriesJson) {
    try {
      categoryOverrides = JSON.parse(categoriesJson);
    } catch {}
  }

  const rows = result.transactions.map((tx, i) => ({
    organisationId: orgId,
    propertyId: resolvedPropertyId,
    type: tx.type,
    source: "CSV_IMPORT" as const,
    category: categoryOverrides[i] ?? tx.category,
    amount: tx.amount,
    currency: "ZAR",
    date: tx.date,
    description: tx.description,
    status: "CLEARED" as const,
    vatAmount: 0,
    vatRate: 0,
    isVatInclusive: false,
  }));

  const { count: saved } = await prisma.transaction.createMany({ data: rows });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");

  return {
    saved,
    duplicates: result.potentialDuplicates.length,
    unrecognised: result.unrecognised.length,
  };
}

// ─────────────────────────────────────────────
// syncRecurringExpenses
// ─────────────────────────────────────────────

export async function syncRecurringExpenses(propertyId: string) {
  await getOrgId();
  await syncRecurring(propertyId);
  revalidatePath("/automation");
  return { success: true };
}

// ─────────────────────────────────────────────
// markAlertRead
// ─────────────────────────────────────────────

export async function markAlertRead(alertId: string) {
  await getOrgId();
  await prisma.alert.update({
    where: { id: alertId },
    data: { isRead: true, readAt: new Date() },
  });
  revalidatePath("/automation");
  revalidatePath("/dashboard");
}

// ─────────────────────────────────────────────
// getAlerts
// ─────────────────────────────────────────────

export async function getAlerts(organisationId: string) {
  return generateAlerts(organisationId);
}

// ─────────────────────────────────────────────
// getDailyDigest
// ─────────────────────────────────────────────

export async function getDailyDigest(organisationId: string, propertyId: string) {
  return generateDailyDigest(organisationId, propertyId);
}

// ─────────────────────────────────────────────
// toggleRecurringExpense
// ─────────────────────────────────────────────

export async function toggleRecurringExpense(id: string, isActive: boolean) {
  await getOrgId();
  await prisma.recurringExpense.update({
    where: { id },
    data: { isActive },
  });
  revalidatePath("/automation");
  return { success: true };
}
