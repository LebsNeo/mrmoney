import { notFound } from "next/navigation";
import Link from "next/link";
import { getInvoiceById } from "@/lib/actions/invoices";
import { PageHeader } from "@/components/PageHeader";
import { InvoiceDetailClient } from "./InvoiceDetailClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params;

  const invoice = await getInvoiceById(id);
  if (!invoice) notFound();

  return (
    <div>
      <div className="mb-2">
        <Link href="/invoices" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          ← Back to Invoices
        </Link>
      </div>
      <PageHeader
        title={`Invoice ${invoice.invoiceNumber}`}
        description={`${invoice.property.name} · Issued ${new Date(invoice.issueDate).toLocaleDateString("en-ZA")}`}
      />
      <InvoiceDetailClient invoice={invoice as any} />
    </div>
  );
}
