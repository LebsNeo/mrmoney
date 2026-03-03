import { requireFinanceAccess } from "@/lib/finance-guard";
import { getTransactions, getTransactionSummary } from "@/lib/actions/transactions";
import { PageHeader } from "@/components/PageHeader";
import { PropertySwitcher } from "@/components/PropertySwitcher";
import { CategorySelect } from "@/components/CategorySelect";
import { EmptyState } from "@/components/EmptyState";
import { ExportButton } from "@/components/ExportButton";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { TransactionsTable } from "@/components/TransactionsTable";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { TransactionType, TransactionCategory } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Suspense } from "react";

interface PageProps {
  searchParams: Promise<{
    propertyId?: string;
    type?: string;
    category?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
  }>;
}

export default async function TransactionsPage({ searchParams }: PageProps) {
  await requireFinanceAccess("/transactions");
  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);
  const type = params.type as TransactionType | undefined;
  const category = params.category as TransactionCategory | undefined;
  const dateFrom = params.dateFrom;
  const dateTo = params.dateTo;

  const session = await getServerSession(authOptions);
  const orgId = (session?.user as any)?.organisationId as string | undefined;

  const allProperties = orgId
    ? await prisma.property.findMany({
        where: { organisationId: orgId, isActive: true, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const filters = {
    type,
    category,
    dateFrom,
    dateTo,
    page,
    limit: 20,
    organisationId: orgId,
    propertyId: params.propertyId,
  };

  const [{ transactions, total, totalPages }, summary] = await Promise.all([
    getTransactions(filters),
    getTransactionSummary(filters),
  ]);

  function buildQuery(overrides: Record<string, string | undefined>) {
    const q = new URLSearchParams();
    if (type) q.set("type", type);
    if (category) q.set("category", category);
    if (dateFrom) q.set("dateFrom", dateFrom);
    if (dateTo) q.set("dateTo", dateTo);
    if (params.propertyId) q.set("propertyId", params.propertyId);
    q.set("page", String(page));
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) q.delete(k);
      else q.set(k, v);
    }
    return q.toString() ? `?${q.toString()}` : "";
  }

  const categoryOptions = Object.values(TransactionCategory);

  const csvData = transactions.map((tx) => ({
    date: formatDate(tx.date),
    description: tx.description,
    vendor: tx.vendor?.name ?? "",
    category: tx.category.replace(/_/g, " "),
    type: tx.type,
    amount: parseFloat(tx.amount.toString()),
    vatAmount: parseFloat(tx.vatAmount.toString()),
    status: tx.status,
  }));

  const incomeBar = summary.totalIncome + summary.totalExpenses > 0
    ? Math.round((summary.totalIncome / (summary.totalIncome + summary.totalExpenses)) * 100)
    : 50;

  return (
    <div>
      <PageHeader
        title="Transactions"
        description={`${total} transaction${total !== 1 ? "s" : ""} total`}
        action={
          <div className="flex items-center gap-2">
            <Suspense fallback={null}>
              <PropertySwitcher properties={allProperties} currentPropertyId={params.propertyId ?? null} />
            </Suspense>
            <ExportButton data={csvData} filename="transactions-export" />
          </div>
        }
      />

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">Total Income</p>
          <p className="text-xl font-bold text-emerald-400">{formatCurrency(summary.totalIncome)}</p>
          <p className="text-xs text-gray-600 mt-0.5">{summary.incomeCount} transactions</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">Total Expenses</p>
          <p className="text-xl font-bold text-red-400">{formatCurrency(summary.totalExpenses)}</p>
          <p className="text-xs text-gray-600 mt-0.5">{summary.expenseCount} transactions</p>
        </div>
        <div className={`bg-gray-900 border rounded-2xl p-4 ${summary.net >= 0 ? "border-emerald-500/20" : "border-red-500/20"}`}>
          <p className="text-xs text-gray-500 mb-1">Net</p>
          <p className={`text-xl font-bold ${summary.net >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {summary.net >= 0 ? "+" : ""}{formatCurrency(summary.net)}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">{summary.net >= 0 ? "surplus" : "deficit"}</p>
        </div>
      </div>

      {/* Income vs expense ratio bar */}
      {(summary.totalIncome > 0 || summary.totalExpenses > 0) && (
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Income {incomeBar}%</span>
            <span>Expenses {100 - incomeBar}%</span>
          </div>
          <div className="h-2 bg-red-500/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${incomeBar}%` }}
            />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Type filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400 font-medium">Type:</label>
          <div className="flex gap-1">
            <Link href={`/transactions${buildQuery({ type: undefined, page: "1" })}`}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${!type ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
              All
            </Link>
            <Link href={`/transactions${buildQuery({ type: "INCOME", page: "1" })}`}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${type === "INCOME" ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
              Income
            </Link>
            <Link href={`/transactions${buildQuery({ type: "EXPENSE", page: "1" })}`}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${type === "EXPENSE" ? "bg-red-500/20 text-red-400" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
              Expense
            </Link>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400 font-medium">Category:</label>
          <CategorySelect options={categoryOptions} current={category} basePath="/transactions" currentType={type} />
        </div>

        {/* Date range filter */}
        <Suspense fallback={null}>
          <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} />
        </Suspense>
      </div>

      {/* Empty state */}
      {transactions.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl">
          <EmptyState
            icon="💳"
            title="No transactions found"
            message={dateFrom || dateTo ? "No transactions in this date range. Try adjusting the filter." : "Import your bank statement or add one manually."}
            actionLabel="Import Bank Statement"
            actionHref="/import/bank"
          />
        </div>
      )}

      {/* Table */}
      {transactions.length > 0 && (
        <>
          <TransactionsTable transactions={transactions} />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Page {page} of {totalPages} · {total} results
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={`/transactions${buildQuery({ page: String(page - 1) })}`}
                    className="px-3 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-300 hover:text-white transition-colors">
                    ← Prev
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={`/transactions${buildQuery({ page: String(page + 1) })}`}
                    className="px-3 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-300 hover:text-white transition-colors">
                    Next →
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
