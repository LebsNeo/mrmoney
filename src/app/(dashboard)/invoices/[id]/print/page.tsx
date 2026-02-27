import { notFound } from "next/navigation";
import { getInvoiceById } from "@/lib/actions/invoices";
import { InvoicePrintView } from "./InvoicePrintView";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InvoicePrintPage({ params }: Props) {
  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) notFound();

  return <InvoicePrintView invoice={invoice as any} />;
}
