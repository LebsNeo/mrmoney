import { getDashboardKPIs } from "@/lib/actions/dashboard";
import { KPICard } from "@/components/KPICard";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { AlertBell } from "@/components/AlertBell";
import { PropertySwitcher } from "@/components/PropertySwitcher";
import { formatCurrency, formatDate, formatPercent, currentPeriod } from "@/lib/utils";
import { calcNights as computeNights } from "@/lib/kpi";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBudgetAlerts } from "@/lib/actions/budget";
import { getBreakEvenRate } from "@/lib/forecasting";
import { generateProfitabilityInsights } from "@/lib/profitability";
import { getKPITrends, getPerformanceBenchmarks } from "@/lib/kpi-engine";
import { generateDailyDigest } from "@/lib/digest";
import Link from "next/link";
import { Suspense } from "react";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const data = await getDashboardKPIs();
  const params = await searchParams;

  const session = await getServerSession(authOptions);
  const orgId = (session?.user as any)?.organisationId as string | undefined;

  // Fetch all properties for the switcher + determine selected property
  const allProperties = orgId
    ? await prisma.property.findMany({
        where: { organisationId: orgId, isActive: true, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];
  const selectedPropertyId = params.propertyId ?? allProperties[0]?.id ?? "";

  // Phase 4: budget alerts + break-even
  let budgetAlerts: Awaited<ReturnType<typeof getBudgetAlerts>> = [];
  let breakEven: Awaited<ReturnType<typeof getBreakEvenRate>> | null = null;

  if (orgId) {
    [budgetAlerts] = await Promise.all([
      getBudgetAlerts(orgId),
    ]);

    if (selectedPropertyId) {
      breakEven = await getBreakEvenRate(selectedPropertyId, currentPeriod());
    }
  }

  // Phase 5: Profitability insights
  let topInsights: string[] = [];
  if (orgId && selectedPropertyId) {
    try {
      const allInsights = await generateProfitabilityInsights(selectedPropertyId, currentPeriod());
      topInsights = allInsights.slice(0, 3);
    } catch {
      topInsights = [];
    }
  }

  // Phase 6: KPI widgets
  interface KPITrendRow { period: string; RevPAR: { value: number }; cancellationRate: { value: number }; avgLengthOfStay: { value: number } }
  let kpiTrends: KPITrendRow[] = [];
  let isBestRevPAREver = false;
  let currentAvgStay = 0;
  let currentCancellationRate = 0;

  if (orgId && selectedPropertyId) {
    try {
      const [trends, benchmarks] = await Promise.all([
        getKPITrends(selectedPropertyId, 6),
        getPerformanceBenchmarks(selectedPropertyId, currentPeriod()),
      ]);
      kpiTrends = trends as KPITrendRow[];
      const currentSnap = trends[trends.length - 1];
      if (currentSnap) {
        currentCancellationRate = currentSnap.cancellationRate.value;
        currentAvgStay = currentSnap.avgLengthOfStay.value;
      }
      const revParBenchmark = benchmarks.benchmarks.find((b) => b.kpi === "RevPAR");
      isBestRevPAREver = revParBenchmark?.isBestEver ?? false;
    } catch {
      kpiTrends = [];
    }
  }

  const overBudgetCount = budgetAlerts.filter((a) => a.status === "OVER_BUDGET").length;
  const warningCount = budgetAlerts.filter((a) => a.status === "WARNING").length;
  const totalAlerts = overBudgetCount + warningCount;

  // Phase 7: Daily Digest preview + alert count
  let digest: Awaited<ReturnType<typeof generateDailyDigest>> | null = null;
  let unreadAlertCount = 0;

  if (orgId) {
    if (selectedPropertyId) {
      try {
        digest = await generateDailyDigest(orgId, selectedPropertyId);
      } catch {
        digest = null;
      }
    }

    try {
      unreadAlertCount = await prisma.alert.count({
        where: { organisationId: orgId, isRead: false },
      });
    } catch {
      unreadAlertCount = 0;
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <PageHeader
          title="Dashboard"
          description={`Overview for ${formatDate(data.period.start, "MMMM yyyy")}`}
          gradient
        />
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <Suspense fallback={null}>
            <PropertySwitcher properties={allProperties} currentPropertyId={selectedPropertyId} />
          </Suspense>
          <AlertBell unreadCount={unreadAlertCount} />
        </div>
      </div>

      {/* Phase 7 — Daily Digest Preview */}
      {digest && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="glass rounded-xl p-4 hover:border-white/10 transition-all">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Check-ins Today</p>
            <p className="text-2xl font-bold gradient-text">{digest.todayCheckIns}</p>
          </div>
          <div className="glass rounded-xl p-4 hover:border-white/10 transition-all">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Check-outs Today</p>
            <p className="text-2xl font-bold gradient-text-blue">{digest.todayCheckOuts}</p>
          </div>
          <div className={`rounded-xl border p-4 transition-all ${digest.cashPosition >= 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"}`}>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Cash Position</p>
            <p className={`text-base font-bold truncate ${digest.cashPosition >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatCurrency(digest.cashPosition)}
            </p>
          </div>
          <Link href="/digest" className="glass rounded-xl p-4 hover:border-emerald-500/20 transition-all group">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Daily Digest</p>
            <p className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">View full digest →</p>
          </Link>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <KPICard
          label="Total Revenue"
          value={formatCurrency(data.totalRevenue)}
          subValue="Net (after OTA commission)"
          accent="emerald"
          featured
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        <KPICard
          label="Occupancy Rate"
          value={formatPercent(data.occupancyRate)}
          subValue={`${data.occupiedRoomNights} of ${data.totalRooms * new Date().getDate()} available nights`}
          accent="blue"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
            </svg>
          }
        />

        <KPICard
          label="ADR"
          value={formatCurrency(data.adr)}
          subValue="Average Daily Rate"
          accent="gold"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          }
        />

        <KPICard
          label="RevPAR"
          value={formatCurrency(data.revpar)}
          subValue="Revenue Per Available Room"
          accent="rose"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
            </svg>
          }
        />
      </div>

      {/* Cash Position Banner */}
      <div className={`rounded-2xl border p-6 mb-8 flex items-center justify-between ${
        data.cashPosition >= 0
          ? "bg-emerald-500/5 border-emerald-500/20"
          : "bg-red-500/5 border-red-500/20"
      }`}>
        <div>
          <p className="text-sm text-gray-400 mb-1">Cash Position (Cleared)</p>
          <p className={`text-3xl font-bold ${data.cashPosition >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {formatCurrency(data.cashPosition)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Cleared income minus cleared expenses</p>
        </div>
        <div className={`p-4 rounded-xl ${data.cashPosition >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
          <svg className={`w-8 h-8 ${data.cashPosition >= 0 ? "text-emerald-400" : "text-red-400"}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" />
          </svg>
        </div>
      </div>

      {/* Phase 4 — Budget Alert + Break-even + Forecast Link */}
      {totalAlerts > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-amber-400 text-lg">⚠</span>
            <p className="text-sm text-amber-400">
              {overBudgetCount > 0 && `${overBudgetCount} ${overBudgetCount === 1 ? "category" : "categories"} over budget`}
              {overBudgetCount > 0 && warningCount > 0 && " · "}
              {warningCount > 0 && `${warningCount} ${warningCount === 1 ? "category" : "categories"} approaching limit`}
              {" "}this month.
            </p>
          </div>
          <Link href="/budget" className="text-xs text-amber-400 hover:text-amber-300 font-medium shrink-0">
            View →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        {/* Break-even card */}
        {breakEven && (
          <div className={`rounded-2xl border p-4 ${breakEven.isAboveBreakEven ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"}`}>
            <p className="text-xs text-gray-500 mb-2">Break-Even Status</p>
            <p className="text-sm text-white">
              Room rate <span className="font-semibold text-white">{formatCurrency(breakEven.currentADR)}</span>
              {" "}| Break-even <span className="font-semibold">{formatCurrency(breakEven.breakEvenADR)}</span>
            </p>
            <p className={`text-xs mt-1 font-medium ${breakEven.isAboveBreakEven ? "text-emerald-400" : "text-red-400"}`}>
              {breakEven.isAboveBreakEven
                ? `✓ Above break-even by ${formatCurrency(breakEven.gap)}`
                : `✗ Below break-even by ${formatCurrency(Math.abs(breakEven.gap))}`}
            </p>
          </div>
        )}

        {/* View Forecast link card */}
        <Link
          href="/forecast"
          className="rounded-2xl border border-gray-800 bg-gray-900 p-4 hover:bg-gray-800 transition-colors group flex items-center justify-between"
        >
          <div>
            <p className="text-xs text-gray-500 mb-1">Forecasting</p>
            <p className="text-sm text-white font-medium">Cash Flow & Revenue Forecast</p>
            <p className="text-xs text-gray-500 mt-1">30-day outlook, budget vs actual</p>
          </div>
          <svg className="w-5 h-5 text-gray-600 group-hover:text-emerald-400 transition-colors shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>

        {/* Budget link card */}
        <Link
          href="/budget"
          className="rounded-2xl border border-gray-800 bg-gray-900 p-4 hover:bg-gray-800 transition-colors group flex items-center justify-between"
        >
          <div>
            <p className="text-xs text-gray-500 mb-1">Budget</p>
            <p className="text-sm text-white font-medium">Budget vs Actual</p>
            <p className="text-xs text-gray-500 mt-1">Track spend against targets</p>
          </div>
          <svg className="w-5 h-5 text-gray-600 group-hover:text-emerald-400 transition-colors shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">Recent Transactions</h2>
            <p className="text-xs text-gray-500 mt-0.5">Last 10 transactions</p>
          </div>
          <div className="divide-y divide-gray-800">
            {data.recentTransactions.length === 0 ? (
              <p className="px-6 py-8 text-center text-gray-500 text-sm">No transactions yet</p>
            ) : (
              data.recentTransactions.map((tx) => (
                <div key={tx.id} className="px-6 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{tx.description}</p>
                    <p className="text-xs text-gray-500">{tx.category.replace(/_/g, " ")} · {formatDate(tx.date)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${tx.type === "INCOME" ? "text-emerald-400" : "text-red-400"}`}>
                      {tx.type === "INCOME" ? "+" : "-"}{formatCurrency(tx.amount)}
                    </p>
                    <StatusBadge status={tx.status.toLowerCase()} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Bookings */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">Upcoming Check-ins</h2>
            <p className="text-xs text-gray-500 mt-0.5">Next 7 days</p>
          </div>
          <div className="divide-y divide-gray-800">
            {data.upcomingBookings.length === 0 ? (
              <p className="px-6 py-8 text-center text-gray-500 text-sm">No upcoming check-ins</p>
            ) : (
              data.upcomingBookings.map((booking) => {
                let nights = 0;
                try {
                  nights = computeNights(new Date(booking.checkIn), new Date(booking.checkOut));
                } catch {}
                return (
                  <div key={booking.id} className="px-6 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{booking.guestName}</p>
                      <p className="text-xs text-gray-500">
                        {booking.room.name} · {formatDate(booking.checkIn)} · {nights}n
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <StatusBadge status={booking.status.toLowerCase()} />
                      <p className="text-xs text-gray-500 mt-1">{booking.source.replace(/_/g, " ")}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Phase 6 — KPI Widgets */}
      {kpiTrends.length > 0 && (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* RevPAR Trend */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500">RevPAR Trend</p>
                <p className="text-sm font-semibold text-white">Last 6 months</p>
              </div>
              <Link href="/kpis" className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors shrink-0">
                Full KPI report →
              </Link>
            </div>
            <div className="flex items-end gap-2 flex-wrap">
              {kpiTrends.map((t, i) => {
                const isLast = i === kpiTrends.length - 1;
                return (
                  <div key={t.period} className="flex flex-col items-center gap-1">
                    <span className={`text-xs font-semibold ${isLast ? "text-emerald-400" : "text-gray-400"}`}>
                      {formatCurrency(t.RevPAR.value)}
                    </span>
                    <span className="text-[10px] text-gray-600">
                      {t.period.split("-")[1]}/{t.period.split("-")[0].slice(2)}
                    </span>
                  </div>
                );
              })}
            </div>
            {isBestRevPAREver && (
              <div className="mt-3 flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                <span className="text-amber-400 text-sm">🏆</span>
                <p className="text-xs text-amber-300 font-medium">Best RevPAR month ever!</p>
              </div>
            )}
          </div>

          {/* Avg Length of Stay */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-1">Avg Length of Stay</p>
              <p className="text-3xl font-bold text-white">
                {currentAvgStay.toFixed(1)}
                <span className="text-base font-normal text-gray-400 ml-1">nights</span>
              </p>
            </div>
            <p className="text-xs text-gray-500 mt-2">Current month average</p>
          </div>

          {/* Cancellation Rate Badge */}
          <div className={`rounded-2xl border p-4 flex flex-col justify-between ${
            currentCancellationRate < 0.05
              ? "bg-emerald-500/5 border-emerald-500/20"
              : currentCancellationRate < 0.1
              ? "bg-amber-500/5 border-amber-500/20"
              : "bg-red-500/5 border-red-500/20"
          }`}>
            <div>
              <p className="text-xs text-gray-500 mb-1">Cancellation Rate</p>
              <p className={`text-3xl font-bold ${
                currentCancellationRate < 0.05
                  ? "text-emerald-400"
                  : currentCancellationRate < 0.1
                  ? "text-amber-400"
                  : "text-red-400"
              }`}>
                {formatPercent(currentCancellationRate)}
              </p>
            </div>
            <div className={`mt-2 text-xs font-medium inline-flex items-center gap-1 ${
              currentCancellationRate < 0.05
                ? "text-emerald-400"
                : currentCancellationRate < 0.1
                ? "text-amber-400"
                : "text-red-400"
            }`}>
              {currentCancellationRate < 0.05
                ? "✓ Healthy"
                : currentCancellationRate < 0.1
                ? "⚠ Watch this"
                : "✗ High — investigate"}
            </div>
          </div>
        </div>
      )}

      {/* Phase 5 — Profitability Insights */}
      <div className="mt-8 bg-gray-900 border border-gray-800 rounded-2xl">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Profitability Insights</h2>
            <p className="text-xs text-gray-500 mt-0.5">Auto-generated from your data this month</p>
          </div>
          <Link
            href="/profitability"
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
          >
            View full profitability report →
          </Link>
        </div>
        <div className="p-6">
          {topInsights.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-gray-500 text-sm">No insights for this period.</p>
              <Link href="/profitability" className="text-xs text-emerald-400 hover:text-emerald-300 mt-1 inline-block">
                View full profitability report →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {topInsights.map((insight, idx) => {
                const isWarning = insight.includes("low margin") || insight.includes("up ");
                const isPositive = insight.includes("more profitable");
                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 rounded-xl p-4 border ${
                      isWarning
                        ? "bg-amber-500/5 border-amber-500/20"
                        : isPositive
                        ? "bg-emerald-500/5 border-emerald-500/20"
                        : "bg-blue-500/5 border-blue-500/20"
                    }`}
                  >
                    <span className="text-base shrink-0">
                      {isWarning ? "⚠️" : isPositive ? "📈" : "💡"}
                    </span>
                    <p className={`text-xs ${isWarning ? "text-amber-300" : isPositive ? "text-emerald-300" : "text-blue-300"}`}>
                      {insight}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
