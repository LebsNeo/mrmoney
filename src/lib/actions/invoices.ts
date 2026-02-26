"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { InvoiceStatus, TransactionStatus, PaymentMethod } from "@prisma/client";
import { logger } from "@/lib/logger";

// ─────────────────────────────────────────────
// MARK INVOICE PAID
// Creates Receipt, updates Invoice → PAID, Transaction → RECONCILED
// ─────────────────────────────────────────────

export async function markInvoicePaid(
  id: string,
  paymentMethod: PaymentMethod,
  reference: string
) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        transactions: {
          where: { status: { not: TransactionStatus.VOID } },
        },
      },
    });

    if (!invoice) {
      return { success: false, message: "Invoice not found" };
    }

    if (invoice.status === InvoiceStatus.PAID) {
      return { success: false, message: "Invoice is already marked as paid" };
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      return { success: false, message: "Cannot mark a cancelled invoice as paid" };
    }

    await prisma.$transaction(async (tx) => {
      // Create receipt
      await tx.receipt.create({
        data: {
          organisationId: invoice.organisationId,
          transactionId: invoice.transactions[0]?.id ?? invoice.id, // fallback
          invoiceId: invoice.id,
          amount: invoice.totalAmount,
          paymentMethod,
          date: new Date(),
          reference,
          notes: `Payment received for invoice ${invoice.invoiceNumber}`,
        },
      });

      // Update all related transactions to RECONCILED
      if (invoice.transactions.length > 0) {
        await tx.transaction.updateMany({
          where: {
            invoiceId: invoice.id,
            status: { not: TransactionStatus.VOID },
          },
          data: { status: TransactionStatus.RECONCILED },
        });
      }

      // Update invoice to PAID
      await tx.invoice.update({
        where: { id },
        data: { status: InvoiceStatus.PAID },
      });
    });

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${id}`);
    revalidatePath("/bookings");

    logger.info("Invoice marked as paid", { invoiceId: id, paymentMethod });
    return { success: true, message: "Invoice marked as paid. Receipt created." };
  } catch (err) {
    logger.error("markInvoicePaid failed", err, { invoiceId: id });
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: msg };
  }
}

// ─────────────────────────────────────────────
// GET INVOICES — paginated with filters
// ─────────────────────────────────────────────

export interface InvoiceFilters {
  status?: InvoiceStatus;
  propertyId?: string;
  page?: number;
  limit?: number;
}

export async function getInvoices(filters: InvoiceFilters = {}) {
  const { status, propertyId, page = 1, limit = 20 } = filters;
  const skip = (page - 1) * limit;

  const now = new Date();

  const where = {
    deletedAt: null,
    // For OVERDUE filter: show explicitly-OVERDUE invoices AND past-due SENT/DRAFT
    ...(status === InvoiceStatus.OVERDUE
      ? {
          OR: [
            { status: InvoiceStatus.OVERDUE },
            {
              status: { in: [InvoiceStatus.SENT, InvoiceStatus.DRAFT] as InvoiceStatus[] },
              dueDate: { lt: now },
            },
          ],
        }
      : status
      ? { status }
      : {}),
    ...(propertyId && { propertyId }),
  };

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        booking: { select: { guestName: true, id: true } },
        property: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.invoice.count({ where }),
  ]);

  // Enrich with effective status (flag overdue)
  const enriched = invoices.map((inv) => ({
    ...inv,
    effectiveStatus:
      (inv.status === InvoiceStatus.SENT || inv.status === InvoiceStatus.DRAFT) &&
      inv.dueDate < now
        ? InvoiceStatus.OVERDUE
        : inv.status,
  }));

  return {
    invoices: enriched,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ─────────────────────────────────────────────
// GET INVOICE BY ID — full detail with booking + receipts
// ─────────────────────────────────────────────

export async function getInvoiceById(id: string) {
  const now = new Date();
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      booking: {
        include: {
          room: true,
          property: true,
        },
      },
      property: true,
      transactions: { orderBy: { date: "desc" } },
      receipts: { orderBy: { date: "desc" } },
    },
  });

  if (!invoice) return null;

  return {
    ...invoice,
    effectiveStatus:
      (invoice.status === InvoiceStatus.SENT || invoice.status === InvoiceStatus.DRAFT) &&
      invoice.dueDate < now
        ? InvoiceStatus.OVERDUE
        : invoice.status,
  };
}
