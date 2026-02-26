import Link from "next/link";
import { getInvoices } from "@/lib/actions/invoices";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { MarkInvoicePaidButton } from "@/components/MarkInvoicePaidButton";
import { EmptyState } from "@/components/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils";
import { InvoiceStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface PageProps {
  searchParams: Promise<{
    status?: string;
    page?: string;
  }>;
}

// All status filter options (OVERDUE is a real status in the schema)
const FILTER_OPTIONS = Object.values(InvoiceStatus);

export default async function InvoicesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);
  const rawStatus = params.status;

  const session = await getServerSession(authOptions);
  const orgId = (session?.user as any)?.organisationId as string | undefined;

  const { invoices, total, totalPages } = await getInvoices({
    status: rawStatus as InvoiceStatus | undefined,
    page,
    limit: 20,
    organisationId: orgId,
  });

  function buildQuery(overrides: Record<string, string | undefined>) {
    const q = new URLSearchParams();
    if (rawStatus) q.set("status", rawStatus);
    q.set("page", String(page));
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) q.delete(k);
      else q.set(k, v);
    }
    return q.toString() ? `?${q.toString()}` : "";
  }

  const now = new Date();

  return (
    <div>
      <PageHeader
        title="Invoices"
        description={`${total} invoice${total !== 1 ? "s" : ""} total`}
      />

      {/* Status Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          href={`/invoices${buildQuery({ status: undefined, page: "1" })}`}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            !rawStatus ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-800 text-gray-400 hover:text-white"
          }`}
        >
          All
        </Link>
        {FILTER_OPTIONS.map((s) => (
          <Link
            key={s}
            href={`/invoices${buildQuery({ status: s, page: "1" })}`}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              rawStatus === s
                ? s === "OVERDUE"
                  ? "bg-red-500/20 text-red-400"
                  : "bg-emerald-500/20 text-emerald-400"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {s.replace(/_/g, " ")}
          </Link>
        ))}
      </div>

      {/* Invoices Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Invoice #</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Booking / Guest</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Issue Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Due Date</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon="🧾"
                      title="No invoices yet"
                      message="Invoices are created automatically when bookings are confirmed."
                    />
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const isOverdue = inv.effectiveStatus === InvoiceStatus.OVERDUE;
                  const isPaid = inv.status === InvoiceStatus.PAID;
                  const isCancelled = inv.status === InvoiceStatus.CANCELLED;
                  const isActionable =
                    !isPaid && !isCancelled && inv.status !== InvoiceStatus.DRAFT;

                  return (
                    <tr
                      key={inv.id}
                      className={`transition-colors ${
                        isOverdue
                          ? "bg-red-500/5 hover:bg-red-500/10"
                          : "hover:bg-gray-800/50"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="font-mono text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {inv.booking ? (
                          <div>
                            <p className="text-white">{inv.booking.guestName}</p>
                            <Link
                              href={`/bookings/${inv.booking.id}`}
                              className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
                            >
                              View Booking →
                            </Link>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-sm">
                        {formatDate(inv.issueDate)}
                      </td>
                      <td className={`px-4 py-3 text-sm ${isOverdue ? "text-red-400 font-medium" : "text-gray-300"}`}>
                        {formatDate(inv.dueDate)}
                        {isOverdue && (
                          <span className="block text-xs text-red-500">
                            {Math.round((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24))} days overdue
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-white">
                        {formatCurrency(inv.totalAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={inv.effectiveStatus.toLowerCase()} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isActionable && (
                          <MarkInvoicePaidButton
                            invoiceId={inv.id}
                            invoiceNumber={inv.invoiceNumber}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="border-t border-gray-800 px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Page {page} of {totalPages} · {total} results
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/invoices${buildQuery({ page: String(page - 1) })}`}
                  className="px-3 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-300 hover:text-white"
                >
                  ← Prev
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/invoices${buildQuery({ page: String(page + 1) })}`}
                  className="px-3 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-300 hover:text-white"
                >
                  Next →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
