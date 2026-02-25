import { getTransactions } from "@/lib/actions/transactions";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { CategorySelect } from "@/components/CategorySelect";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { TransactionType, TransactionCategory } from "@prisma/client";

interface PageProps {
  searchParams: Promise<{
    type?: string;
    category?: string;
    page?: string;
  }>;
}

export default async function TransactionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);
  const type = params.type as TransactionType | undefined;
  const category = params.category as TransactionCategory | undefined;

  const { transactions, total, totalPages } = await getTransactions({
    type,
    category,
    page,
    limit: 20,
  });

  function buildQuery(overrides: Record<string, string | undefined>) {
    const q = new URLSearchParams();
    if (type) q.set("type", type);
    if (category) q.set("category", category);
    q.set("page", String(page));
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) q.delete(k);
      else q.set(k, v);
    }
    return q.toString() ? `?${q.toString()}` : "";
  }

  const categoryOptions = Object.values(TransactionCategory);

  return (
    <div>
      <PageHeader
        title="Transactions"
        description={`${total} transaction${total !== 1 ? "s" : ""} total`}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Type filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400 font-medium">Type:</label>
          <div className="flex gap-1">
            <Link
              href={`/transactions${buildQuery({ type: undefined, page: "1" })}`}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                !type ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              All
            </Link>
            <Link
              href={`/transactions${buildQuery({ type: "INCOME", page: "1" })}`}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                type === "INCOME" ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              Income
            </Link>
            <Link
              href={`/transactions${buildQuery({ type: "EXPENSE", page: "1" })}`}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                type === "EXPENSE" ? "bg-red-500/20 text-red-400" : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              Expense
            </Link>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400 font-medium">Category:</label>
          <CategorySelect
            options={categoryOptions}
            current={category}
            basePath="/transactions"
            currentType={type}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Description</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Category</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">VAT</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    No transactions found
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{formatDate(tx.date)}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white">{tx.description}</p>
                        {tx.vendor && (
                          <p className="text-xs text-gray-500">{tx.vendor.name}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
                        {tx.category.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={tx.type.toLowerCase()} />
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${
                      tx.type === "INCOME" ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {tx.type === "INCOME" ? "+" : "-"}{formatCurrency(tx.amount)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">
                      {formatCurrency(tx.vatAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={tx.status.toLowerCase()} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-gray-800 px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Page {page} of {totalPages} · {total} results
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/transactions${buildQuery({ page: String(page - 1) })}`}
                  className="px-3 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-300 hover:text-white transition-colors"
                >
                  ← Prev
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/transactions${buildQuery({ page: String(page + 1) })}`}
                  className="px-3 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-300 hover:text-white transition-colors"
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
