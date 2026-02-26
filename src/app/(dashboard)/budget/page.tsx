import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { getBudgetVsActual } from "@/lib/budget-analysis";
import { getBudgetAlerts } from "@/lib/actions/budget";
import { formatCurrency, currentPeriod } from "@/lib/utils";
import { format } from "date-fns";
import Link from "next/link";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    "ON_TRACK": "bg-emerald-500/20 text-emerald-400",
    "OVER_BUDGET": "bg-red-500/20 text-red-400",
    "WARNING": "bg-amber-500/20 text-amber-400",
    "UNDER_SPEND": "bg-blue-500/20 text-blue-400",
  };
  const label: Record<string, string> = {
    "ON_TRACK": "On Track",
    "OVER_BUDGET": "Over Budget",
    "WARNING": "Warning",
    "UNDER_SPEND": "Under Spend",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${map[status] ?? "bg-gray-500/20 text-gray-400"}`}>
      {label[status] ?? status}
    </span>
  );
}

export default async function BudgetPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const orgId = (session.user as any).organisationId as string;

  const property = await prisma.property.findFirst({
    where: { organisationId: orgId, isActive: true, deletedAt: null },
    select: { id: true, name: true },
  });

  if (!property) {
    return (
      <div>
        <PageHeader title="Budget" description="No active property found." />
      </div>
    );
  }

  const period = currentPeriod();
  const [budgetItems, alerts] = await Promise.all([
    getBudgetVsActual(property.id, period),
    getBudgetAlerts(orgId),
  ]);

  const totalBudget = budgetItems.reduce((sum, i) => sum + i.budgetedAmount, 0);
  const totalActual = budgetItems.reduce((sum, i) => sum + i.actualAmount, 0);
  const variance = totalBudget - totalActual;
  const pctUsed = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;
  const overBudgetCount = budgetItems.filter((i) => i.status === "OVER_BUDGET").length;

  return (
    <div>
      <PageHeader
        title="Budget"
        description={`${property.name} · ${format(new Date(period + "-01"), "MMMM yyyy")}`}
      />

      {/* Alert Banner */}
      {overBudgetCount > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 mb-6 flex items-center gap-3">
          <span className="text-red-400 text-lg">⚠</span>
          <p className="text-sm text-red-400">
            {overBudgetCount} {overBudgetCount === 1 ? "category is" : "categories are"} over budget this month.
          </p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">Total Budget</p>
          <p className="text-xl font-bold text-white">{formatCurrency(totalBudget)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">Total Actual</p>
          <p className="text-xl font-bold text-white">{formatCurrency(totalActual)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">Variance</p>
          <p className={`text-xl font-bold ${variance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {formatCurrency(variance)}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-2">% Used</p>
          <p className={`text-xl font-bold ${pctUsed > 100 ? "text-red-400" : pctUsed > 80 ? "text-amber-400" : "text-emerald-400"}`}>
            {pctUsed.toFixed(1)}%
          </p>
          <div className="w-full bg-gray-800 rounded-full h-1.5 mt-2">
            <div
              className={`h-1.5 rounded-full ${pctUsed > 100 ? "bg-red-500" : pctUsed > 80 ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: `${Math.min(100, pctUsed)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Category Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Category Breakdown</h2>
            <p className="text-xs text-gray-500 mt-0.5">Budget vs actual by expense category</p>
          </div>
          <Link
            href="/budget/edit"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Set Budget
          </Link>
        </div>

        {budgetItems.length === 0 ? (
          <EmptyState
            icon="📊"
            title="No budget set"
            message="Set a monthly budget to track spending vs targets."
            actionLabel="Set Budget"
            actionHref="/budget/edit"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                  <th className="px-6 py-3 text-left">Category</th>
                  <th className="px-6 py-3 text-right">Budgeted</th>
                  <th className="px-6 py-3 text-right">Actual Spent</th>
                  <th className="px-6 py-3 text-right">Remaining</th>
                  <th className="px-6 py-3 text-right">% Used</th>
                  <th className="px-6 py-3 text-left w-32">Progress</th>
                  <th className="px-6 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {budgetItems.map((item) => {
                  const pct =
                    item.budgetedAmount > 0
                      ? Math.min(100, (item.actualAmount / item.budgetedAmount) * 100)
                      : 0;
                  const rowClass =
                    item.status === "OVER_BUDGET"
                      ? "bg-red-500/5"
                      : item.status === "WARNING"
                      ? "bg-amber-500/5"
                      : "";
                  const barColor =
                    item.status === "OVER_BUDGET"
                      ? "bg-red-500"
                      : item.status === "WARNING"
                      ? "bg-amber-500"
                      : "bg-emerald-500";

                  return (
                    <tr key={item.category} className={`${rowClass} hover:bg-gray-800/30`}>
                      <td className="px-6 py-3 text-white font-medium">
                        {item.category.replace(/_/g, " ")}
                      </td>
                      <td className="px-6 py-3 text-right text-gray-300">
                        {formatCurrency(item.budgetedAmount)}
                      </td>
                      <td className={`px-6 py-3 text-right font-medium ${item.status === "OVER_BUDGET" ? "text-red-400" : "text-gray-300"}`}>
                        {formatCurrency(item.actualAmount)}
                      </td>
                      <td className="px-6 py-3 text-right text-gray-400">
                        {formatCurrency(item.variance)}
                      </td>
                      <td className="px-6 py-3 text-right text-gray-400">
                        {pct.toFixed(1)}%
                      </td>
                      <td className="px-6 py-3">
                        <div className="w-24 bg-gray-800 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${barColor}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <StatusBadge status={item.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-700">
                  <td className="px-6 py-3 text-white font-semibold">Total</td>
                  <td className="px-6 py-3 text-right text-white font-semibold">
                    {formatCurrency(totalBudget)}
                  </td>
                  <td className="px-6 py-3 text-right text-white font-semibold">
                    {formatCurrency(totalActual)}
                  </td>
                  <td className="px-6 py-3 text-right text-gray-400 font-semibold">
                    {formatCurrency(variance)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Cross-property alerts */}
      {alerts.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">Budget Alerts — All Properties</h2>
            <p className="text-xs text-gray-500 mt-0.5">Categories requiring attention</p>
          </div>
          <div className="divide-y divide-gray-800">
            {alerts.map((alert, idx) => (
              <div key={idx} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">
                    {alert.propertyName} · {alert.category.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-gray-500">
                    Budget: {formatCurrency(alert.budgetedAmount)} · Actual: {formatCurrency(alert.actualAmount)}
                  </p>
                </div>
                <StatusBadge status={alert.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
