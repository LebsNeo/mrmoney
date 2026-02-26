import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { PropertySwitcher } from "@/components/PropertySwitcher";
import {
  getCashFlowForecast,
  getRevenueForecast,
  getBreakEvenRate,
} from "@/lib/forecasting";
import { getBudgetVsActual } from "@/lib/budget-analysis";
import { formatCurrency, formatDate, formatPercent, currentPeriod } from "@/lib/utils";
import { format, addDays } from "date-fns";
import Link from "next/link";
import { Suspense } from "react";

function weekLabel(weekIndex: number) {
  return `Week ${weekIndex + 1}`;
}

function StatusBadgeInline({ status }: { status: string }) {
  const map: Record<string, string> = {
    "ON_TRACK": "bg-emerald-500/20 text-emerald-400",
    "AT_RISK": "bg-amber-500/20 text-amber-400",
    "BELOW_BREAK_EVEN": "bg-red-500/20 text-red-400",
    "OVER_BUDGET": "bg-red-500/20 text-red-400",
    "WARNING": "bg-amber-500/20 text-amber-400",
    "UNDER_SPEND": "bg-blue-500/20 text-blue-400",
  };
  const label: Record<string, string> = {
    "ON_TRACK": "On Track",
    "AT_RISK": "At Risk",
    "BELOW_BREAK_EVEN": "Below Break-Even",
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

export default async function ForecastPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const orgId = (session.user as any).organisationId as string;

  // Load all properties for the switcher
  const allProperties = await prisma.property.findMany({
    where: { organisationId: orgId, isActive: true, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const selectedPropertyId = params.propertyId ?? allProperties[0]?.id ?? "";

  if (!selectedPropertyId) {
    return (
      <div>
        <PageHeader title="Forecast" description="No active property found." />
        <p className="text-gray-400 text-sm">
          Please add a property before viewing forecasts.
        </p>
      </div>
    );
  }

  const propertyId = selectedPropertyId;
  const propertyName = allProperties.find((p) => p.id === propertyId)?.name ?? "";
  const period = currentPeriod();

  // Fetch all data in parallel
  const [cashFlowData, revenueMonths, budgetItems, breakEven] = await Promise.all([
    getCashFlowForecast(propertyId, 30),
    getRevenueForecast(propertyId, 3),
    getBudgetVsActual(propertyId, period),
    getBreakEvenRate(propertyId, period),
  ]);

  const { days, upcomingOTAPayouts } = cashFlowData;

  // Aggregate cash flow into 4 weeks
  const weeks = [0, 1, 2, 3].map((weekIdx) => {
    const weekDays = days.slice(weekIdx * 7, weekIdx * 7 + 7);
    const income = weekDays.reduce((sum, d) => sum + d.expectedIncome, 0);
    const expenses = weekDays.reduce((sum, d) => sum + d.expectedExpenses, 0);
    const net = income - expenses;
    const lastDay = weekDays[weekDays.length - 1];
    return {
      label: weekLabel(weekIdx),
      income,
      expenses,
      net,
      cumulative: lastDay?.cumulativeBalance ?? 0,
    };
  });

  const totalIncome30 = days.reduce((sum, d) => sum + d.expectedIncome, 0);
  const totalExpenses30 = days.reduce((sum, d) => sum + d.expectedExpenses, 0);
  const netCashFlow30 = totalIncome30 - totalExpenses30;
  const currentBalance = days[days.length - 1]?.cumulativeBalance ?? 0;

  // Revenue month statuses
  const revenueWithStatus = revenueMonths.map((m) => {
    const monthBreakEven = breakEven.breakEvenADR;
    const currentADR = breakEven.currentADR;
    let status = "ON_TRACK";
    if (currentADR < monthBreakEven) {
      status = "BELOW_BREAK_EVEN";
    } else if (m.projectedOccupancy < 0.5) {
      status = "AT_RISK";
    }
    return { ...m, status, breakEvenADR: monthBreakEven, currentADR };
  });

  // Budget summary
  const totalBudget = budgetItems.reduce((sum, i) => sum + i.budgetedAmount, 0);
  const totalActual = budgetItems.reduce((sum, i) => sum + i.actualAmount, 0);
  const overBudgetCount = budgetItems.filter((i) => i.status === "OVER_BUDGET").length;

  return (
    <div>
      <PageHeader
        title="Forecast & Budget"
        description={`Property: ${propertyName}`}
        action={
          <Suspense fallback={null}>
            <PropertySwitcher properties={allProperties} currentPropertyId={selectedPropertyId} />
          </Suspense>
        }
      />

      {/* ─── SECTION 1: CASH FLOW ─── */}
      <section className="mb-10">
        <h2 className="text-base font-semibold text-white mb-4">
          Cash Flow Forecast — Next 30 Days
        </h2>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-1">Expected Income (30d)</p>
            <p className="text-xl font-bold text-emerald-400">
              {formatCurrency(totalIncome30)}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-1">Expected Expenses (30d)</p>
            <p className="text-xl font-bold text-red-400">
              {formatCurrency(totalExpenses30)}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-1">Net Cash Flow</p>
            <p className={`text-xl font-bold ${netCashFlow30 >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatCurrency(netCashFlow30)}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-1">Period-End Balance</p>
            <p className={`text-xl font-bold ${currentBalance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatCurrency(currentBalance)}
            </p>
          </div>
        </div>

        {/* Week-by-Week Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white">Week-by-Week Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                  <th className="px-6 py-3 text-left">Week</th>
                  <th className="px-6 py-3 text-right">Expected Income</th>
                  <th className="px-6 py-3 text-right">Expected Expenses</th>
                  <th className="px-6 py-3 text-right">Net</th>
                  <th className="px-6 py-3 text-right">Cumulative Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {weeks.map((week) => (
                  <tr key={week.label} className="hover:bg-gray-800/50">
                    <td className="px-6 py-3 text-white font-medium">{week.label}</td>
                    <td className="px-6 py-3 text-right text-emerald-400">
                      {formatCurrency(week.income)}
                    </td>
                    <td className="px-6 py-3 text-right text-red-400">
                      {formatCurrency(week.expenses)}
                    </td>
                    <td className={`px-6 py-3 text-right font-semibold ${week.net >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {formatCurrency(week.net)}
                    </td>
                    <td className={`px-6 py-3 text-right font-semibold ${week.cumulative >= 0 ? "text-white" : "text-red-400"}`}>
                      {formatCurrency(week.cumulative)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* OTA Payout Callout */}
        {upcomingOTAPayouts.length > 0 && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-amber-400 mb-3">
              📅 Upcoming OTA Payouts
            </h3>
            <div className="space-y-2">
              {upcomingOTAPayouts.slice(0, 10).map((payout) => (
                <div
                  key={payout.bookingId}
                  className="flex items-center justify-between text-sm"
                >
                  <div>
                    <span className="text-white">{payout.guestName}</span>
                    <span className="text-gray-500 ml-2">
                      · {payout.source.replace(/_/g, " ")} · checkout{" "}
                      {formatDate(payout.checkOut)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-400 font-medium">
                      {formatCurrency(payout.amount)}
                    </span>
                    <span className="text-gray-500 text-xs ml-2">
                      due {formatDate(payout.expectedPayoutDate)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ─── SECTION 2: REVENUE FORECAST ─── */}
      <section className="mb-10">
        <h2 className="text-base font-semibold text-white mb-4">
          Revenue Forecast — Next 3 Months
        </h2>

        {/* Break-even warning */}
        {!breakEven.isAboveBreakEven && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 mb-4 flex items-center gap-3">
            <span className="text-red-400 text-lg">⚠</span>
            <p className="text-sm text-red-400">
              Current ADR ({formatCurrency(breakEven.currentADR)}) is below break-even rate ({formatCurrency(breakEven.breakEvenADR)}). Gap: {formatCurrency(Math.abs(breakEven.gap))}.
            </p>
          </div>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                  <th className="px-6 py-3 text-left">Month</th>
                  <th className="px-6 py-3 text-right">Confirmed Revenue</th>
                  <th className="px-6 py-3 text-right">Projected Revenue</th>
                  <th className="px-6 py-3 text-right">Projected Occ %</th>
                  <th className="px-6 py-3 text-right">Break-Even ADR</th>
                  <th className="px-6 py-3 text-right">Current ADR</th>
                  <th className="px-6 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {revenueWithStatus.map((m) => (
                  <tr key={m.period} className="hover:bg-gray-800/50">
                    <td className="px-6 py-4 text-white font-medium">
                      {format(new Date(m.period + "-01"), "MMMM yyyy")}
                    </td>
                    <td className="px-6 py-4 text-right text-emerald-400">
                      {formatCurrency(m.confirmedRevenue)}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-300">
                      {formatCurrency(m.projectedRevenue)}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-300">
                      {formatPercent(m.projectedOccupancy)}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-300">
                      {formatCurrency(m.breakEvenADR)}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-300">
                      {formatCurrency(m.currentADR)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadgeInline status={m.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── SECTION 3: BUDGET VS ACTUAL ─── */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">
            Budget vs Actual — {format(new Date(period + "-01"), "MMMM yyyy")}
          </h2>
          <Link
            href="/budget"
            className="text-sm text-emerald-400 hover:text-emerald-300 font-medium"
          >
            Manage Budgets →
          </Link>
        </div>

        {/* Over budget alert */}
        {overBudgetCount > 0 && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 mb-4 flex items-center gap-3">
            <span className="text-red-400 text-lg">⚠</span>
            <p className="text-sm text-red-400">
              {overBudgetCount} {overBudgetCount === 1 ? "category is" : "categories are"} over budget this month.
            </p>
          </div>
        )}

        {budgetItems.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
            <p className="text-gray-500 text-sm">No budget set for this period.</p>
            <Link
              href="/budget/edit"
              className="mt-3 inline-block text-sm text-emerald-400 hover:text-emerald-300"
            >
              Set a budget →
            </Link>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
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
                    const pctUsed =
                      item.budgetedAmount > 0
                        ? Math.min(100, (item.actualAmount / item.budgetedAmount) * 100)
                        : 0;
                    const rowClass =
                      item.status === "OVER_BUDGET"
                        ? "bg-red-500/5"
                        : item.status === "WARNING"
                        ? "bg-amber-500/5"
                        : "";
                    const barClass =
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
                          {pctUsed.toFixed(1)}%
                        </td>
                        <td className="px-6 py-3">
                          <div className="w-24 bg-gray-800 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${barClass}`}
                              style={{ width: `${pctUsed}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <StatusBadgeInline status={item.status} />
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
                      {formatCurrency(totalBudget - totalActual)}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
