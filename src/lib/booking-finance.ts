/**
 * MrMoney — Booking Finance Engine
 * Phase 3: Booking ↔ Finance Integration
 *
 * All functions use prisma.$transaction for atomicity.
 * No financial records are deleted — only VOID status.
 * Nights always derived via calcNights() — never stored.
 */

import { prisma } from "@/lib/prisma";
import { calcNights, calcVATAmount } from "@/lib/kpi";
import { generateInvoiceNumber, toNumber } from "@/lib/utils";
import { logger } from "@/lib/logger";
import {
  BookingStatus,
  InvoiceStatus,
  TransactionType,
  TransactionSource,
  TransactionCategory,
  TransactionStatus,
} from "@prisma/client";

export interface FinanceResult {
  success: boolean;
  message: string;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/** Generate the next invoice number for an organisation */
async function nextInvoiceNumber(organisationId: string): Promise<string> {
  const count = await prisma.invoice.count({ where: { organisationId } });
  return generateInvoiceNumber("INV", count + 1);
}

/** Validate that a booking exists and return it with its property */
async function fetchBooking(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      property: {
        include: { organisation: true },
      },
      room: true,
      invoices: true,
      transactions: true,
    },
  });
  if (!booking) throw new Error(`Booking ${bookingId} not found`);
  return booking;
}

// ─────────────────────────────────────────────
// ON BOOKING CONFIRMED — Creates DRAFT Invoice
// ─────────────────────────────────────────────

export async function onBookingConfirmed(bookingId: string): Promise<FinanceResult> {
  try {
    const booking = await fetchBooking(bookingId);
    const { organisationId } = booking.property;

    // Check if DRAFT invoice already exists for this booking
    const existingDraft = booking.invoices.find(
      (inv) => inv.status === InvoiceStatus.DRAFT || inv.status === InvoiceStatus.SENT
    );
    if (existingDraft) {
      return {
        success: true,
        message: `Invoice ${existingDraft.invoiceNumber} already exists for this booking`,
      };
    }

    const invoiceNumber = await nextInvoiceNumber(organisationId);
    const grossAmount = toNumber(booking.grossAmount);
    const vatRate = toNumber(booking.vatRate);

    const vatCalc = calcVATAmount(grossAmount, vatRate, booking.isVatInclusive);

    const issueDate = new Date();
    const dueDate = new Date(booking.checkIn);

    await prisma.$transaction(async (tx) => {
      await tx.invoice.create({
        data: {
          organisationId,
          propertyId: booking.propertyId,
          bookingId: booking.id,
          invoiceNumber,
          issueDate,
          dueDate,
          subtotal: vatCalc.exclusiveAmount,
          taxRate: vatRate,
          taxAmount: vatCalc.vatAmount,
          isTaxInclusive: booking.isVatInclusive,
          totalAmount: vatCalc.inclusiveAmount,
          status: InvoiceStatus.DRAFT,
          notes: `Auto-generated on booking confirmation for ${booking.guestName}`,
        },
      });

      // Update booking status to CONFIRMED if not already
      if (booking.status !== BookingStatus.CONFIRMED) {
        await tx.booking.update({
          where: { id: bookingId },
          data: { status: BookingStatus.CONFIRMED },
        });
      }
    });

    logger.info("Invoice created (DRAFT)", { invoiceNumber, bookingId });
    return { success: true, message: `Invoice ${invoiceNumber} created as DRAFT` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("BookingFinance onBookingConfirmed failed", err);
    return { success: false, message: msg };
  }
}

// ─────────────────────────────────────────────
// ON BOOKING CHECKED OUT
// Creates INCOME + EXPENSE (OTA commission), marks invoice SENT
// ─────────────────────────────────────────────

export async function onBookingCheckedOut(bookingId: string): Promise<FinanceResult> {
  try {
    const booking = await fetchBooking(bookingId);
    const { organisationId } = booking.property;

    // Validate state transition
    if (booking.status !== BookingStatus.CHECKED_IN) {
      return {
        success: false,
        message: `Cannot check out booking with status ${booking.status}. Must be CHECKED_IN first.`,
      };
    }

    // Derive nights (never stored)
    const nights = calcNights(new Date(booking.checkIn), new Date(booking.checkOut));
    const grossAmount = toNumber(booking.grossAmount);
    const netAmount = toNumber(booking.netAmount);
    const otaCommission = toNumber(booking.otaCommission);
    const vatRate = toNumber(booking.vatRate);
    const checkOutDate = new Date(booking.checkOut);

    // Calculate VAT on net income
    const vatCalc = calcVATAmount(netAmount, vatRate, booking.isVatInclusive);

    await prisma.$transaction(async (tx) => {
      // Find existing draft invoice
      const invoice = await tx.invoice.findFirst({
        where: { bookingId, status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.SENT] } },
      });

      // Create INCOME transaction — accommodation
      await tx.transaction.create({
        data: {
          organisationId,
          propertyId: booking.propertyId,
          bookingId: booking.id,
          invoiceId: invoice?.id,
          type: TransactionType.INCOME,
          source: TransactionSource.BOOKING,
          category: TransactionCategory.ACCOMMODATION,
          amount: grossAmount,
          currency: booking.property.currency,
          date: checkOutDate,
          description: `Accommodation — ${booking.guestName} · ${nights} night${nights !== 1 ? "s" : ""} (${booking.room.name})`,
          reference: bookingId,
          vatRate: booking.vatRate,
          vatAmount: vatCalc.vatAmount,
          isVatInclusive: booking.isVatInclusive,
          status: TransactionStatus.PENDING,
        },
      });

      // Create EXPENSE transaction for OTA commission (if applicable)
      if (otaCommission > 0 && booking.source !== "DIRECT" && booking.source !== "WALKIN") {
        await tx.transaction.create({
          data: {
            organisationId,
            propertyId: booking.propertyId,
            bookingId: booking.id,
            invoiceId: invoice?.id,
            type: TransactionType.EXPENSE,
            source: TransactionSource.BOOKING,
            category: TransactionCategory.OTA_COMMISSION,
            amount: otaCommission,
            currency: booking.property.currency,
            date: checkOutDate,
            description: `OTA Commission — ${booking.source.replace(/_/g, " ")} · ${booking.guestName}`,
            reference: bookingId,
            vatRate: 0,
            vatAmount: 0,
            isVatInclusive: false,
            status: TransactionStatus.PENDING,
          },
        });
      }

      // Update booking status
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CHECKED_OUT },
      });

      // Update invoice to SENT (if it exists)
      if (invoice) {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: InvoiceStatus.SENT },
        });
      }
    });

    logger.info("Checkout transactions created", { bookingId, nights, grossAmount });
    return {
      success: true,
      message: `Checked out. Income transaction created. ${otaCommission > 0 ? "OTA commission recorded." : ""}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("BookingFinance onBookingCheckedOut failed", err);
    return { success: false, message: msg };
  }
}

// ─────────────────────────────────────────────
// ON BOOKING CANCELLED — VOIDs transactions, audit record
// ─────────────────────────────────────────────

export async function onBookingCancelled(bookingId: string, reason: string): Promise<FinanceResult> {
  try {
    const booking = await fetchBooking(bookingId);

    if (booking.status === BookingStatus.CANCELLED) {
      return { success: false, message: "Booking is already cancelled" };
    }
    if (booking.status === BookingStatus.CHECKED_OUT) {
      return { success: false, message: "Cannot cancel a checked-out booking" };
    }

    const { organisationId } = booking.property;

    await prisma.$transaction(async (tx) => {
      // VOID all related transactions
      if (booking.transactions.length > 0) {
        await tx.transaction.updateMany({
          where: {
            bookingId,
            status: { not: TransactionStatus.VOID },
          },
          data: { status: TransactionStatus.VOID },
        });
      }

      // CANCEL related invoices
      await tx.invoice.updateMany({
        where: {
          bookingId,
          status: { notIn: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED] },
        },
        data: { status: InvoiceStatus.CANCELLED },
      });

      // Create audit VOID transaction as a record of cancellation
      await tx.transaction.create({
        data: {
          organisationId,
          propertyId: booking.propertyId,
          bookingId: booking.id,
          type: TransactionType.EXPENSE,
          source: TransactionSource.SYSTEM,
          category: TransactionCategory.OTHER,
          amount: 0,
          currency: booking.property.currency,
          date: new Date(),
          description: `CANCELLED — ${booking.guestName}. Reason: ${reason}`,
          reference: `CANCEL-${bookingId.slice(0, 8)}`,
          vatRate: 0,
          vatAmount: 0,
          isVatInclusive: false,
          status: TransactionStatus.VOID,
        },
      });

      // Update booking status
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CANCELLED, notes: reason },
      });
    });

    logger.info("Booking cancelled — transactions voided", { bookingId, reason });
    return { success: true, message: `Booking cancelled. All related transactions voided.` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("BookingFinance onBookingCancelled failed", err);
    return { success: false, message: msg };
  }
}

// ─────────────────────────────────────────────
// ON BOOKING NO-SHOW — VOIDs transactions, logs impact
// ─────────────────────────────────────────────

export async function onBookingNoShow(bookingId: string): Promise<FinanceResult> {
  try {
    const booking = await fetchBooking(bookingId);

    if (booking.status !== BookingStatus.CONFIRMED) {
      return {
        success: false,
        message: `Cannot mark no-show for booking with status ${booking.status}. Must be CONFIRMED.`,
      };
    }

    const { organisationId } = booking.property;
    const grossAmount = toNumber(booking.grossAmount);

    await prisma.$transaction(async (tx) => {
      // VOID all related transactions
      if (booking.transactions.length > 0) {
        await tx.transaction.updateMany({
          where: {
            bookingId,
            status: { not: TransactionStatus.VOID },
          },
          data: { status: TransactionStatus.VOID },
        });
      }

      // CANCEL related invoices
      await tx.invoice.updateMany({
        where: {
          bookingId,
          status: { notIn: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED] },
        },
        data: { status: InvoiceStatus.CANCELLED },
      });

      // Create no-show impact audit record
      await tx.transaction.create({
        data: {
          organisationId,
          propertyId: booking.propertyId,
          bookingId: booking.id,
          type: TransactionType.EXPENSE,
          source: TransactionSource.SYSTEM,
          category: TransactionCategory.OTHER,
          amount: 0,
          currency: booking.property.currency,
          date: new Date(),
          description: `NO-SHOW — ${booking.guestName}. Lost revenue: ${grossAmount.toFixed(2)} ${booking.property.currency}`,
          reference: `NOSHOW-${bookingId.slice(0, 8)}`,
          vatRate: 0,
          vatAmount: 0,
          isVatInclusive: false,
          status: TransactionStatus.VOID,
        },
      });

      // Update booking status
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.NO_SHOW,
          notes: `No-show logged on ${new Date().toISOString().split("T")[0]}. Lost gross revenue: ${grossAmount.toFixed(2)}`,
        },
      });
    });

    logger.info("No-show recorded — revenue voided", { bookingId, grossAmount });
    return {
      success: true,
      message: `No-show recorded. Related transactions voided. Lost revenue logged.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("BookingFinance onBookingNoShow failed", err);
    return { success: false, message: msg };
  }
}
