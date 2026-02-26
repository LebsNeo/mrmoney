import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { PropertySwitcher } from "@/components/PropertySwitcher";
import { OccupancyCalendar } from "@/components/OccupancyCalendar";
import { Suspense } from "react";
import { ExportButton } from "@/components/ExportButton";
import {
  getKPITrends,
  getKPISummary,
  getOccupancyCalendar,
  getRevenueLeakageReport,
  getPerformanceBenchmarks,
} from "@/lib/actions/kpis";
import {
  formatCurrency,
  formatPercent,
  currentPeriod,
  formatMonth,
} from "@/lib/utils";
import { format, parseISO, subMonths } from "date-fns";
import Link from "next/link";

// ─── Helpers ─────────────────────────────────

function TrendArrow({
  trend,
  inverted = false,
}: {
  trend: "UP" | "DOWN" | "FLAT";
  inverted?: boolean;
}) {
  if (trend === "FLAT") return <span className="text-gray-500 text-xs">→</span>;
  const isGood = inverted ? trend === "DOWN" : trend === "UP";
  return (
    <span className={`text-xs font-bold ${isGood ? "text-emerald-400" : "text-red-400"}`}>
      {trend === "UP" ? "↑" : "↓"}
    </span>
  );
}

function StatusPill({ status }: { status: "IMPROVING" | "DECLINING" | "STABLE" | "N/A" }) {
  const styles = {
    IMPROVING: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    DECLINING: "bg-red-500/10 text-red-400 border-red-500/20",
    STABLE: "bg-gray-700 text-gray-400 border-gray-600",
    "N/A": "bg-gray-800 text-gray-600 border-gray-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${styles[status]}`}>
      {status}
    </span>
  );
}

// ─────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────

export default async function KPIsPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string; months?: string }>;
}) {
  const params = await searchParams;
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as any)?.organisationId as string | undefined;

  // Load properties
  const properties = orgId
    ? await prisma.property.findMany({
        where: { organisationId: orgId, isActive: true, deletedAt: null },
        orderBy: { name: "asc" },
      })
    : [];

  const selectedPropertyId =
    params.propertyId ?? properties[0]?.id ?? null;

  const monthsParam = parseInt(params.months ?? "6", 10);
  const months = [3, 6, 12].includes(monthsParam) ? monthsParam : 6;

  const currentMonth = currentPeriod();

  if (!selectedPropertyId) {
    return (
      <div>
        <PageHeader title="KPI Dashboard" description="No properties found" />
        <div className="text-center py-16 text-gray-500">
          <p>No properties available. Add a property to start tracking KPIs.</p>
        </div>
      </div>
    );
  }

  // Fetch all KPI data in parallel
  const [trends, occupancyCalendarData, leakage, benchmarks] = await Promise.all([
    getKPITrends(selectedPropertyId, months),
    getOccupancyCalendar(selectedPropertyId, currentMonth),
    getRevenueLeakageReport(selectedPropertyId, currentMonth),
    getPerformanceBenchmarks(selectedPropertyId, currentMonth),
  ]);

  // Find best value per column for highlighting
  const bestValues = {
    occupancyRate: Math.max(...trends.map((t) => t.occupancyRate.value)),
    ADR: Math.max(...trends.map((t) => t.ADR.value)),
    RevPAR: Math.max(...trends.map((t) => t.RevPAR.value)),
    totalRevenue: Math.max(...trends.map((t) => t.totalRevenue.value)),
    netProfit: Math.max(...trends.map((t) => t.netProfit.value)),
    totalBookings: Math.max(...trends.map((t) => t.totalBookings.value)),
    avgLengthOfStay: Math.max(...trends.map((t) => t.avgLengthOfStay.value)),
    cancellationRate: Math.min(
      ...trends.filter((t) => t.cancellationRate.value > 0).map((t) => t.cancellationRate.value)
    ),
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="KPI Dashboard"
        description="Trend analysis, occupancy, leakage & benchmarks"
        action={
          <Suspense fallback={null}>
            <PropertySwitcher properties={properties} currentPropertyId={selectedPropertyId} />
          </Suspense>
        }
      />

      {/* ─── Filters ─── */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Property selector */}
        {properties.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {properties.map((p) => (
              <Link
                key={p.id}
                href={`/kpis?propertyId=${p.id}&months=${months}`}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  selectedPropertyId === p.id
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"
                }`}
              >
                {p.name}
              </Link>
            ))}
          </div>
        )}

        {/* Period selector */}
        <div className="flex gap-2 ml-auto">
          {[3, 6, 12].map((m) => (
            <Link
              key={m}
              href={`/kpis?propertyId=${selectedPropertyId}&months=${m}`}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                months === m
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"
              }`}
            >
              {m}M
            </Link>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════
          SECTION 1 — KPI Trend Table
      ════════════════════════════════════════ */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">
            Monthly KPI Trends — Last {months} Months
          </h2>
          <ExportButton
            data={trends.map((t) => ({
              period: t.period,
              occupancyRate: (t.occupancyRate.value * 100).toFixed(1) + "%",
              ADR: t.ADR.value.toFixed(2),
              RevPAR: t.RevPAR.value.toFixed(2),
              totalRevenue: t.totalRevenue.value.toFixed(2),
              netProfit: t.netProfit.value.toFixed(2),
              totalBookings: t.totalBookings.value,
              avgLengthOfStay: t.avgLengthOfStay.value.toFixed(1),
              cancellationRate: (t.cancellationRate.value * 100).toFixed(1) + "%",
            }))}
            filename="kpi-trends"
          />
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-gray-800">
                  {[
                    "Month",
                    "Occupancy%",
                    "ADR",
                    "RevPAR",
                    "Revenue",
                    "Net Profit",
                    "Bookings",
                    "Avg Stay",
                    "Cancel%",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-medium text-gray-500 px-4 py-3 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {trends.map((row) => {
                  const isCurrentMonth = row.period === currentMonth;
                  const rowBase = isCurrentMonth
                    ? "bg-emerald-500/5"
                    : "hover:bg-gray-800/50";

                  function isBest(field: keyof typeof bestValues, val: number) {
                    if (field === "cancellationRate") {
                      return val === bestValues.cancellationRate && val > 0;
                    }
                    return val > 0 && val === bestValues[field];
                  }

                  function cellClass(field: keyof typeof bestValues, val: number) {
                    return isBest(field, val)
                      ? "text-white font-semibold bg-emerald-500/10"
                      : "text-gray-300";
                  }

                  return (
                    <tr key={row.period} className={`${rowBase} transition-colors`}>
                      {/* Month */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-sm font-medium ${isCurrentMonth ? "text-emerald-400" : "text-gray-200"}`}>
                          {format(parseISO(`${row.period}-01`), "MMM yyyy")}
                        </span>
                        {isCurrentMonth && (
                          <span className="ml-2 text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">
                            current
                          </span>
                        )}
                      </td>

                      {/* Occupancy */}
                      <td className={`px-4 py-3 ${cellClass("occupancyRate", row.occupancyRate.value)}`}>
                        <div className="flex items-center gap-1.5">
                          <TrendArrow trend={row.occupancyRate.trend} />
                          {formatPercent(row.occupancyRate.value)}
                        </div>
                      </td>

                      {/* ADR */}
                      <td className={`px-4 py-3 ${cellClass("ADR", row.ADR.value)}`}>
                        <div className="flex items-center gap-1.5">
                          <TrendArrow trend={row.ADR.trend} />
                          {formatCurrency(row.ADR.value)}
                        </div>
                      </td>

                      {/* RevPAR */}
                      <td className={`px-4 py-3 ${cellClass("RevPAR", row.RevPAR.value)}`}>
                        <div className="flex items-center gap-1.5">
                          <TrendArrow trend={row.RevPAR.trend} />
                          {formatCurrency(row.RevPAR.value)}
                        </div>
                      </td>

                      {/* Revenue */}
                      <td className={`px-4 py-3 ${cellClass("totalRevenue", row.totalRevenue.value)}`}>
                        <div className="flex items-center gap-1.5">
                          <TrendArrow trend={row.totalRevenue.trend} />
                          {formatCurrency(row.totalRevenue.value)}
                        </div>
                      </td>

                      {/* Net Profit */}
                      <td className={`px-4 py-3 ${cellClass("netProfit", row.netProfit.value)}`}>
                        <div className="flex items-center gap-1.5">
                          <TrendArrow trend={row.netProfit.trend} />
                          <span className={row.netProfit.value < 0 ? "text-red-400" : ""}>
                            {formatCurrency(row.netProfit.value)}
                          </span>
                        </div>
                      </td>

                      {/* Bookings */}
                      <td className={`px-4 py-3 ${cellClass("totalBookings", row.totalBookings.value)}`}>
                        <div className="flex items-center gap-1.5">
                          <TrendArrow trend={row.totalBookings.trend} />
                          {row.totalBookings.value}
                        </div>
                      </td>

                      {/* Avg Stay */}
                      <td className={`px-4 py-3 ${cellClass("avgLengthOfStay", row.avgLengthOfStay.value)}`}>
                        <div className="flex items-center gap-1.5">
                          <TrendArrow trend={row.avgLengthOfStay.trend} />
                          {row.avgLengthOfStay.value.toFixed(1)}n
                        </div>
                      </td>

                      {/* Cancel% */}
                      <td className={`px-4 py-3 ${cellClass("cancellationRate", row.cancellationRate.value)}`}>
                        <div className="flex items-center gap-1.5">
                          <TrendArrow trend={row.cancellationRate.trend} inverted />
                          {formatPercent(row.cancellationRate.value)}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {trends.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                      No data for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-gray-800 flex items-center gap-4 text-xs text-gray-600">
            <span>↑ green = improvement · ↓ red = decline</span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-emerald-500/20 inline-block" /> best month per column
            </span>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          SECTION 2 — Occupancy Calendar
      ════════════════════════════════════════ */}
      <section>
        <h2 className="text-sm font-semibold text-white mb-4">
          Occupancy Calendar — {formatMonth(currentMonth + "-01")}
        </h2>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <OccupancyCalendar data={occupancyCalendarData} />
        </div>
      </section>

      {/* ════════════════════════════════════════
          SECTION 3 — Revenue Leakage
      ════════════════════════════════════════ */}
      <section>
        <h2 className="text-sm font-semibold text-white mb-4">Revenue Leakage Report</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          {/* Summary row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-800/50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Expected Revenue</p>
              <p className="text-xl font-bold text-white">{formatCurrency(leakage.expectedRevenue)}</p>
              <p className="text-xs text-gray-500 mt-1">Checked-out bookings</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Actual Income (Cleared)</p>
              <p className="text-xl font-bold text-white">{formatCurrency(leakage.actualRevenue)}</p>
              <p className="text-xs text-gray-500 mt-1">Cleared + reconciled transactions</p>
            </div>
            <div
              className={`rounded-xl p-4 ${
                leakage.totalLeakage > 0
                  ? "bg-red-500/10 border border-red-500/20"
                  : "bg-emerald-500/10 border border-emerald-500/20"
              }`}
            >
              <p className="text-xs text-gray-500 mb-1">Leakage</p>
              <p className={`text-xl font-bold ${leakage.totalLeakage > 0 ? "text-red-400" : "text-emerald-400"}`}>
                {formatCurrency(leakage.totalLeakage)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {leakage.leakagePercent.toFixed(1)}% of expected
              </p>
            </div>
          </div>

          {/* Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between py-3 border-t border-gray-800">
              <div>
                <p className="text-sm text-gray-300">OTA Commissions</p>
                <p className="text-xs text-gray-500">Paid to platforms from checked-out bookings</p>
              </div>
              <p className="text-sm font-semibold text-amber-400">
                -{formatCurrency(leakage.totalOTACommissions)}
              </p>
            </div>

            <div className="flex items-center justify-between py-3 border-t border-gray-800">
              <div>
                <p className="text-sm text-gray-300">Cancellation Revenue Loss</p>
                <p className="text-xs text-gray-500">Revenue from bookings cancelled this month</p>
              </div>
              <p className="text-sm font-semibold text-red-400">
                -{formatCurrency(leakage.cancellationLoss)}
              </p>
            </div>

            <div className="flex items-center justify-between py-3 border-t border-gray-800">
              <div>
                <p className="text-sm text-gray-300">Unmatched OTA Payouts</p>
                <p className="text-xs text-gray-500">
                  {leakage.unmatchedPayoutItems} payout item{leakage.unmatchedPayoutItems !== 1 ? "s" : ""} not yet matched to a booking
                </p>
              </div>
              <p className="text-sm font-semibold text-amber-400">
                {formatCurrency(leakage.unmatchedPayoutTotal)}
              </p>
            </div>
          </div>

          {/* Callout */}
          {leakage.unmatchedPayoutItems > 0 && (
            <div className="mt-4 flex items-center gap-3 bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
              <span className="text-amber-400 text-lg shrink-0">⚠</span>
              <p className="text-sm text-amber-300">
                <span className="font-semibold">{formatCurrency(leakage.unmatchedPayoutTotal)}</span>
                {" "}in unreconciled OTA payouts ({leakage.unmatchedPayoutItems} item{leakage.unmatchedPayoutItems !== 1 ? "s" : ""}).{" "}
                <Link href="/ota-payouts" className="underline hover:text-amber-200 transition-colors">
                  Reconcile now →
                </Link>
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ════════════════════════════════════════
          SECTION 4 — Performance Benchmarks
      ════════════════════════════════════════ */}
      <section>
        <h2 className="text-sm font-semibold text-white mb-4">
          Performance vs Benchmarks — {formatMonth(currentMonth + "-01")}
        </h2>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-800">
                  {["KPI", "This Period", "Last Year", "3M Avg", "vs Last Year", "vs 3M Avg"].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-medium text-gray-500 px-4 py-3 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {benchmarks.benchmarks.map((b) => {
                  const formatVal = (val: number | null, kpi: string): string => {
                    if (val === null) return "—";
                    if (kpi === "Occupancy Rate" || kpi === "Cancellation Rate") {
                      return formatPercent(val);
                    }
                    if (kpi === "Avg Length of Stay") return `${val.toFixed(1)}n`;
                    return formatCurrency(val);
                  };

                  return (
                    <tr key={b.kpi} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3 text-gray-300 font-medium">
                        <div className="flex items-center gap-2">
                          {b.kpi}
                          {b.isBestEver && (
                            <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full border border-amber-500/30">
                              🏆 Best ever
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white font-semibold">
                        {formatVal(b.currentValue, b.kpi)}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {formatVal(b.lastYearValue, b.kpi)}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {formatVal(b.threeMonthAvg, b.kpi)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={b.vsLastYear} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={b.vs3MAvg} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
