import { notFound } from "next/navigation";
import { verifyInvoiceToken } from "@/lib/invoice-token";
import { prisma } from "@/lib/prisma";
import { InvoicePrintView } from "@/app/(dashboard)/invoices/[id]/print/InvoicePrintView";
import type { LineItem } from "@/lib/actions/invoices";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PublicInvoiceViewPage({ params }: Props) {
  const { token } = await params;

  const invoiceId = verifyInvoiceToken(token);
  if (!invoiceId) notFound();

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId, deletedAt: null },
    include: {
      property: true,
      booking: { include: { room: true } },
    },
  });

  if (!invoice) notFound();

  return (
    <InvoicePrintView
      isPublic
      invoice={{
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        subtotal: invoice.subtotal,
        taxRate: invoice.taxRate,
        taxAmount: invoice.taxAmount,
        totalAmount: invoice.totalAmount,
        clientName: invoice.clientName,
        clientEmail: invoice.clientEmail,
        lineItems: invoice.lineItems as LineItem[] | null,
        notes: invoice.notes,
        sentAt: invoice.sentAt,
        property: {
          name: invoice.property.name,
          address: invoice.property.address,
          suburb: (invoice.property as any).suburb ?? null,
          city: invoice.property.city,
          postalCode: (invoice.property as any).postalCode ?? null,
          phone: (invoice.property as any).phone ?? null,
          email: (invoice.property as any).email ?? null,
          taxNumber: (invoice.property as any).taxNumber ?? null,
          logoUrl: (invoice.property as any).logoUrl ?? null,
          website: (invoice.property as any).website ?? null,
          bankName: (invoice.property as any).bankName ?? null,
          bankAccount: (invoice.property as any).bankAccount ?? null,
          bankBranch: (invoice.property as any).bankBranch ?? null,
          invoiceFooter: (invoice.property as any).invoiceFooter ?? null,
        },
        booking: invoice.booking
          ? {
              guestName: invoice.booking.guestName,
              checkIn: invoice.booking.checkIn,
              checkOut: invoice.booking.checkOut,
              room: invoice.booking.room ? { name: invoice.booking.room.name } : null,
            }
          : null,
      }}
    />
  );
}
