"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
  organisationId?: string;
  page?: number;
  limit?: number;
}

export async function getInvoices(filters: InvoiceFilters = {}) {
  const { status, propertyId, organisationId, page = 1, limit = 20 } = filters;
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
    ...(organisationId && { organisationId }),
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

// ─────────────────────────────────────────────
// UPDATE INVOICE — edit client info, line items, notes
// ─────────────────────────────────────────────

export interface LineItem {
  description: string;
  qty: number;
  unitPrice: number;
  amount: number;
}

export interface UpdateInvoiceInput {
  clientName?: string;
  clientEmail?: string;
  lineItems?: LineItem[];
  notes?: string;
  taxRate?: number;
  dueDate?: Date;
}

export async function updateInvoice(id: string, data: UpdateInvoiceInput) {
  try {
    const session = await getServerSession(authOptions);
    const orgId = (session?.user as { organisationId?: string })?.organisationId;
    if (!orgId) return { success: false, message: "Unauthorised" };

    const invoice = await prisma.invoice.findFirst({
      where: { id, organisationId: orgId, deletedAt: null },
    });
    if (!invoice) return { success: false, message: "Invoice not found" };

    // Recalculate totals from line items if provided
    let subtotal = Number(invoice.subtotal);
    let taxRate = data.taxRate !== undefined ? data.taxRate : Number(invoice.taxRate);
    let taxAmount = Number(invoice.taxAmount);
    let totalAmount = Number(invoice.totalAmount);

    if (data.lineItems && data.lineItems.length > 0) {
      subtotal = data.lineItems.reduce((s, i) => s + i.amount, 0);
      taxAmount = subtotal * taxRate;
      totalAmount = subtotal + taxAmount;
    }

    await prisma.invoice.update({
      where: { id },
      data: {
        clientName: data.clientName?.trim() || null,
        clientEmail: data.clientEmail?.trim() || null,
        lineItems: data.lineItems ? JSON.parse(JSON.stringify(data.lineItems)) : undefined,
        notes: data.notes?.trim() || null,
        taxRate,
        taxAmount,
        subtotal,
        totalAmount,
        ...(data.dueDate ? { dueDate: data.dueDate } : {}),
      },
    });

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${id}`);
    return { success: true, message: "Invoice updated" };
  } catch (err) {
    logger.error("updateInvoice failed", err, { invoiceId: id });
    return { success: false, message: "Failed to update invoice" };
  }
}

// ─────────────────────────────────────────────
// SEND INVOICE EMAIL via Resend
// ─────────────────────────────────────────────

export async function sendInvoiceEmail(id: string) {
  try {
    const session = await getServerSession(authOptions);
    const orgId = (session?.user as { organisationId?: string })?.organisationId;
    if (!orgId) return { success: false, message: "Unauthorised" };

    const invoice = await prisma.invoice.findFirst({
      where: { id, organisationId: orgId, deletedAt: null },
      include: {
        property: true,
        booking: true,
      },
    });
    if (!invoice) return { success: false, message: "Invoice not found" };

    // Resolve client name + email (invoice fields take priority over booking)
    const clientEmail =
      invoice.clientEmail ||
      (invoice.booking as { guestEmail?: string } | null)?.guestEmail;
    const clientName =
      invoice.clientName ||
      invoice.booking?.guestName ||
      "Valued Guest";

    if (!clientEmail) {
      return {
        success: false,
        message: "No client email address. Please add one before sending.",
      };
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        message: "Email not configured. Please add RESEND_API_KEY to your environment.",
      };
    }

    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    const property = invoice.property;
    const fromName = property.name;
    const fromEmail = process.env.RESEND_FROM_EMAIL || "invoices@mrmoney.app";
    const printUrl = `${process.env.NEXTAUTH_URL}/invoices/${id}/print`;
    const footer = property.invoiceFooter ||
      `Thank you for choosing ${property.name}. We look forward to welcoming you again!`;

    const lineItems = (invoice.lineItems as LineItem[] | null) ?? [];
    const lineItemsHtml = lineItems.length > 0
      ? `<table style="width:100%;border-collapse:collapse;margin:16px 0">
          <thead><tr style="background:#f3f4f6">
            <th style="text-align:left;padding:8px;font-size:12px">Description</th>
            <th style="text-align:center;padding:8px;font-size:12px">Qty</th>
            <th style="text-align:right;padding:8px;font-size:12px">Unit Price</th>
            <th style="text-align:right;padding:8px;font-size:12px">Amount</th>
          </tr></thead>
          <tbody>${lineItems.map(i => `
            <tr style="border-bottom:1px solid #e5e7eb">
              <td style="padding:8px;font-size:13px">${i.description}</td>
              <td style="padding:8px;text-align:center;font-size:13px">${i.qty}</td>
              <td style="padding:8px;text-align:right;font-size:13px">R${Number(i.unitPrice).toFixed(2)}</td>
              <td style="padding:8px;text-align:right;font-size:13px">R${Number(i.amount).toFixed(2)}</td>
            </tr>`).join("")}
          </tbody>
        </table>`
      : "";

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
  ${property.logoUrl ? `<img src="${property.logoUrl}" alt="${property.name}" style="max-height:80px;max-width:200px;margin-bottom:16px">` : ""}
  <h2 style="margin:0 0 4px">${property.name}</h2>
  ${property.address ? `<p style="margin:0;color:#6b7280;font-size:13px">${property.address}${property.city ? `, ${property.city}` : ""}</p>` : ""}
  ${property.phone ? `<p style="margin:0;color:#6b7280;font-size:13px">📞 ${property.phone}</p>` : ""}
  ${property.email ? `<p style="margin:0;color:#6b7280;font-size:13px">✉ ${property.email}</p>` : ""}
  ${property.taxNumber ? `<p style="margin:0;color:#6b7280;font-size:13px">VAT/Tax No: ${property.taxNumber}</p>` : ""}

  <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb">

  <table style="width:100%"><tr>
    <td>
      <p style="margin:0;font-size:12px;color:#6b7280;text-transform:uppercase">Invoice To</p>
      <p style="margin:4px 0;font-weight:600">${clientName}</p>
      <p style="margin:0;font-size:13px;color:#6b7280">${clientEmail}</p>
    </td>
    <td style="text-align:right">
      <p style="margin:0;font-size:12px;color:#6b7280;text-transform:uppercase">Invoice</p>
      <p style="margin:4px 0;font-weight:600;font-size:18px">${invoice.invoiceNumber}</p>
      <p style="margin:0;font-size:13px;color:#6b7280">Issued: ${new Date(invoice.issueDate).toLocaleDateString("en-ZA")}</p>
      <p style="margin:0;font-size:13px;color:#6b7280">Due: ${new Date(invoice.dueDate).toLocaleDateString("en-ZA")}</p>
    </td>
  </tr></table>

  ${lineItemsHtml}

  <table style="width:100%;margin-top:8px">
    <tr><td style="text-align:right;padding:4px;font-size:13px">Subtotal:</td>
        <td style="text-align:right;padding:4px;font-size:13px;width:120px">R${Number(invoice.subtotal).toFixed(2)}</td></tr>
    ${Number(invoice.taxAmount) > 0 ? `<tr><td style="text-align:right;padding:4px;font-size:13px">VAT (${(Number(invoice.taxRate)*100).toFixed(0)}%):</td>
        <td style="text-align:right;padding:4px;font-size:13px">R${Number(invoice.taxAmount).toFixed(2)}</td></tr>` : ""}
    <tr><td style="text-align:right;padding:8px;font-weight:700;font-size:15px">Total:</td>
        <td style="text-align:right;padding:8px;font-weight:700;font-size:15px;border-top:2px solid #111">R${Number(invoice.totalAmount).toFixed(2)}</td></tr>
  </table>

  ${property.bankName ? `
  <div style="margin-top:20px;padding:12px;background:#f9fafb;border-radius:8px">
    <p style="margin:0 0 6px;font-size:12px;font-weight:600;text-transform:uppercase;color:#6b7280">Payment Details</p>
    <p style="margin:0;font-size:13px">Bank: ${property.bankName}</p>
    ${property.bankAccount ? `<p style="margin:0;font-size:13px">Account: ${property.bankAccount}</p>` : ""}
    ${property.bankBranch ? `<p style="margin:0;font-size:13px">Branch Code: ${property.bankBranch}</p>` : ""}
    <p style="margin:0;font-size:13px">Reference: ${invoice.invoiceNumber}</p>
  </div>` : ""}

  ${invoice.notes ? `<p style="margin-top:20px;font-size:13px;color:#374151"><strong>Notes:</strong> ${invoice.notes}</p>` : ""}

  <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
  <p style="font-size:14px;color:#374151;font-style:italic">${footer}</p>
  <p style="margin-top:16px;font-size:12px;color:#9ca3af">
    <a href="${printUrl}" style="color:#10b981">View / Download Invoice PDF →</a>
  </p>
</body>
</html>`;

    await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: clientEmail,
      subject: `Invoice ${invoice.invoiceNumber} from ${property.name}`,
      html,
    });

    // Mark as SENT + record sentAt
    await prisma.invoice.update({
      where: { id },
      data: {
        sentAt: new Date(),
        status: invoice.status === "DRAFT" ? "SENT" : invoice.status,
      },
    });

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${id}`);

    logger.info("Invoice email sent", { invoiceId: id, to: clientEmail });
    return { success: true, message: `Invoice sent to ${clientEmail}` };
  } catch (err) {
    logger.error("sendInvoiceEmail failed", err, { invoiceId: id });
    return { success: false, message: "Failed to send invoice email" };
  }
}
