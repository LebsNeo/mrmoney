import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { PropertySwitcher } from "@/components/PropertySwitcher";
import { KPICard } from "@/components/KPICard";
import { Suspense } from "react";
import {
  getProfitabilityByRoom,
  getProfitabilityBySource,
  getMarginPerOccupiedNight,
  getCostBreakdown,
  generateProfitabilityInsights,
} from "@/lib/profitability";
import { formatCurrency, formatPercent, currentPeriod } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ─── Insight icon helper ──────────────────────────────────────────
function insightIcon(text: string): string {
  if (text.includes("low margin") || text.includes("up ")) return "⚠️";
  if (text.includes("more profitable") || text.includes("📈")) return "📈";
  return "💡";
}

export default async function ProfitabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const orgId = (session.user as { organisationId?: string }).organisationId as string;
  const period = currentPeriod();

  const allProperties = await prisma.property.findMany({
    where: { organisationId: orgId, isActive: true, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const selectedPropertyId = params.propertyId ?? allProperties[0]?.id ?? "";

  if (!selectedPropertyId) {
    return (
      <div>
        <PageHeader title="Profitability" description="No active property found." />
        <p className="text-gray-400 text-sm mt-4">Add a property to view profitability data.</p>
      </div>
    );
  }

  const propertyName = allProperties.find((p) => p.id === selectedPropertyId)?.name ?? "";

  const [rooms, sources, margin, costs, insights] = await Promise.all([
    getProfitabilityByRoom(selectedPropertyId, period),
    getProfitabilityBySource(selectedPropertyId, period),
    getMarginPerOccupiedNight(selectedPropertyId, period),
    getCostBreakdown(selectedPropertyId, period),
    generateProfitabilityInsights(selectedPropertyId, period),
  ]);

  const netProfit = margin.totalNetRevenue - margin.totalExpenses;
  const profitMargin = margin.totalNetRevenue > 0 ? netProfit / margin.totalNetRevenue : 0;

  // OTA commission total for summary line
  const otaSources = sources.filter((s) => s.source !== "DIRECT");
  const totalOTACommission = otaSources.reduce((s, x) => s + x.totalCommission, 0);

  const bestRoom = rooms[0] ?? null;
  const worstRoom = rooms[rooms.length - 1] ?? null;

  return (
    <div>
      <PageHeader
        title="Profitability"
        description={`${propertyName} · ${period}`}
        action={
          <Suspense fallback={null}>
            <PropertySwitcher properties={allProperties} currentPropertyId={selectedPropertyId} />
          </Suspense>
        }
      />

      {/* ── SECTION 1: KPI Row ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <KPICard
          label="Net Profit"
          value={formatCurrency(netProfit)}
          subValue="Revenue minus expenses"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          }
        />
        <KPICard
          label="Profit Margin"
          value={formatPercent(profitMargin)}
          subValue="Net / Gross revenue"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125z" />
            </svg>
          }
        />
        <KPICard
          label="Revenue / Occupied Night"
          value={formatCurrency(margin.revenuePerOccupiedNight)}
          subValue={`${margin.occupiedNights} occupied nights`}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
            </svg>
          }
        />
        <KPICard
          label="Cost / Occupied Night"
          value={formatCurrency(margin.costPerOccupiedNight)}
          subValue="Total expenses ÷ nights"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75" />
            </svg>
          }
        />
      </div>

      {/* ── SECTION 2: Room Profitability Table ────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl mb-8">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Room Profitability</h2>
            <p className="text-xs text-gray-500 mt-0.5">Sorted by net profit · highest first</p>
          </div>
        </div>

        {rooms.length === 0 ? (
          <p className="px-6 py-8 text-center text-gray-500 text-sm">No room data for this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Occupancy</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Costs</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Net Profit</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Margin</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {rooms.map((room, idx) => {
                  const isBest = idx === 0;
                  const isWorst = idx === rooms.length - 1 && room.profitMargin < 0.30;
                  const marginColor =
                    room.profitMargin >= 0.6
                      ? "text-emerald-400"
                      : room.profitMargin >= 0.3
                      ? "text-amber-400"
                      : "text-red-400";
                  return (
                    <tr
                      key={room.roomId}
                      className={cn(
                        "transition-colors",
                        isBest && "bg-emerald-500/5",
                        isWorst && "bg-red-500/5"
                      )}
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{room.roomName}</span>
                          {isBest && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400">
                              Best Performer
                            </span>
                          )}
                          {isWorst && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">
                              Needs Attention
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{room.roomType}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{formatPercent(room.occupancyRate, 0)}</td>
                      <td className="px-4 py-3 text-right text-white">{formatCurrency(room.revenue)}</td>
                      <td className="px-4 py-3 text-right text-red-400">{formatCurrency(room.totalCosts)}</td>
                      <td className={cn("px-4 py-3 text-right font-semibold", room.netProfit >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {formatCurrency(room.netProfit)}
                      </td>
                      <td className={cn("px-4 py-3 text-right font-medium", marginColor)}>
                        {formatPercent(room.profitMargin, 1)}
                      </td>
                      <td className="px-6 py-3 text-right text-gray-500">#{room.rank}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── SECTION 3: Booking Source Breakdown ────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl mb-8">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Booking Source Breakdown</h2>
          {totalOTACommission > 0 && (
            <p className="text-xs text-amber-400 mt-1">
              ⚠️ OTA commissions cost you {formatCurrency(totalOTACommission)} this period
            </p>
          )}
        </div>

        {sources.length === 0 ? (
          <p className="px-6 py-8 text-center text-gray-500 text-sm">No bookings for this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Bookings</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Gross Revenue</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Commission</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Net Revenue</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Value</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {sources.map((src) => {
                  const isDirect = src.source === "DIRECT";
                  return (
                    <tr
                      key={src.source}
                      className={cn(isDirect && "bg-emerald-500/5")}
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <span className={cn("font-medium", isDirect ? "text-emerald-400" : "text-white")}>
                            {src.source.replace(/_/g, " ")}
                          </span>
                          {isDirect && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400">
                              Direct
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">{src.bookingCount}</td>
                      <td className="px-4 py-3 text-right text-white">{formatCurrency(src.grossRevenue)}</td>
                      <td className="px-4 py-3 text-right text-red-400">
                        {src.totalCommission > 0 ? formatCurrency(src.totalCommission) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-400">{formatCurrency(src.netRevenue)}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{formatCurrency(src.avgBookingValue)}</td>
                      <td className={cn(
                        "px-6 py-3 text-right font-medium",
                        src.netMargin >= 0.6 ? "text-emerald-400" : src.netMargin >= 0.3 ? "text-amber-400" : "text-red-400"
                      )}>
                        {formatPercent(src.netMargin, 1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── SECTION 4: Cost Breakdown ──────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl mb-8">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Cost Breakdown</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Fixed vs Variable ratio: {formatPercent(costs.fixedPercent, 0)} fixed / {formatPercent(costs.variablePercent, 0)} variable
          </p>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Fixed Costs */}
          <div className="bg-gray-800/50 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Fixed Costs</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(costs.fixed)}</p>
            <p className="text-xs text-gray-500 mt-1">{formatPercent(costs.fixedPercent, 0)} of total</p>
            <div className="mt-3 space-y-1 text-xs text-gray-400">
              <p>Salaries · Linen · Cleaning · Marketing</p>
            </div>
          </div>
          {/* Variable Costs */}
          <div className="bg-gray-800/50 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Variable Costs</p>
            <p className="text-2xl font-bold text-amber-400">{formatCurrency(costs.variable)}</p>
            <p className="text-xs text-gray-500 mt-1">{formatPercent(costs.variablePercent, 0)} of total</p>
            <div className="mt-3 space-y-1 text-xs text-gray-400">
              <p>Utilities · F&amp;B · Laundry</p>
            </div>
          </div>
          {/* One-off Costs */}
          <div className="bg-gray-800/50 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">One-off Costs</p>
            <p className="text-2xl font-bold text-blue-400">{formatCurrency(costs.oneOff)}</p>
            <p className="text-xs text-gray-500 mt-1">{formatPercent(costs.oneOffPercent, 0)} of total</p>
            <div className="mt-3 space-y-1 text-xs text-gray-400">
              <p>Maintenance · Supplies · Other</p>
            </div>
          </div>
        </div>
        {/* Total bar */}
        <div className="px-6 pb-4 flex items-center gap-4">
          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden flex">
            <div className="bg-white/80 h-full transition-all" style={{ width: `${costs.fixedPercent * 100}%` }} />
            <div className="bg-amber-400/80 h-full transition-all" style={{ width: `${costs.variablePercent * 100}%` }} />
            <div className="bg-blue-400/80 h-full transition-all" style={{ width: `${costs.oneOffPercent * 100}%` }} />
          </div>
          <p className="text-xs text-gray-400 shrink-0">Total: {formatCurrency(costs.total)}</p>
        </div>
      </div>

      {/* ── SECTION 5: Insights Panel ──────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Profitability Insights</h2>
          <p className="text-xs text-gray-500 mt-0.5">Auto-generated from your data</p>
        </div>
        <div className="p-6">
          {insights.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">No insights for this period.</p>
              <p className="text-gray-600 text-xs mt-1">
                Add more bookings and transactions to generate actionable insights.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {insights.map((insight, idx) => {
                const icon = insightIcon(insight);
                const isWarning = icon === "⚠️";
                const isPositive = icon === "📈";
                return (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-start gap-3 rounded-xl p-4 border",
                      isWarning
                        ? "bg-amber-500/5 border-amber-500/20"
                        : isPositive
                        ? "bg-emerald-500/5 border-emerald-500/20"
                        : "bg-blue-500/5 border-blue-500/20"
                    )}
                  >
                    <span className="text-lg shrink-0">{icon}</span>
                    <p className={cn(
                      "text-sm",
                      isWarning ? "text-amber-300" : isPositive ? "text-emerald-300" : "text-blue-300"
                    )}>
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
