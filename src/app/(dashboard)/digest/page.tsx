import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { generateDailyDigest } from "@/lib/digest";
import { formatCurrency } from "@/lib/utils";
import { format, subDays } from "date-fns";

export default async function DigestPage() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organisationId?: string })?.organisationId;

  if (!orgId) {
    return (
      <div className="text-gray-500 text-sm p-8">Please sign in to view this page.</div>
    );
  }

  const firstProperty = await prisma.property.findFirst({
    where: { organisationId: orgId, isActive: true, deletedAt: null },
    select: { id: true, name: true },
  });

  if (!firstProperty) {
    return (
      <div>
        <PageHeader title="Daily Digest" description="Your morning briefing" />
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <p className="text-gray-500 text-sm">No property found. Set up a property to see your digest.</p>
        </div>
      </div>
    );
  }

  const digest = await generateDailyDigest(orgId, firstProperty.id);
  const today = new Date();
  const yesterday = subDays(today, 1);

  return (
    <div>
      <PageHeader
        title="Daily Digest"
        description={`Good morning · ${format(today, "EEEE, dd MMMM yyyy")}`}
      />

      {/* Top insight callout */}
      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 mb-6 flex items-start gap-4">
        <span className="text-2xl shrink-0">💡</span>
        <div>
          <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-1">Top Insight</p>
          <p className="text-sm text-white font-medium">{digest.topInsight}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Yesterday Performance */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-gray-800 flex items-center justify-center text-sm">📅</div>
            <div>
              <p className="text-xs text-gray-500">Yesterday</p>
              <p className="text-xs font-semibold text-gray-300">{format(yesterday, "dd MMM yyyy")}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">Revenue</p>
              <p className={`text-sm font-bold ${digest.yesterdayRevenue > 0 ? "text-emerald-400" : "text-gray-400"}`}>
                {formatCurrency(digest.yesterdayRevenue)}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">Check-outs</p>
              <p className="text-sm font-semibold text-white">{digest.yesterdayCheckouts}</p>
            </div>
          </div>
        </div>

        {/* Today Schedule */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-sm">🏨</div>
            <div>
              <p className="text-xs text-gray-500">Today</p>
              <p className="text-xs font-semibold text-gray-300">{format(today, "dd MMM yyyy")}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">Check-ins</p>
              <p className={`text-sm font-bold ${digest.todayCheckIns > 0 ? "text-emerald-400" : "text-gray-400"}`}>
                {digest.todayCheckIns}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">Check-outs</p>
              <p className={`text-sm font-bold ${digest.todayCheckOuts > 0 ? "text-blue-400" : "text-gray-400"}`}>
                {digest.todayCheckOuts}
              </p>
            </div>
          </div>
        </div>

        {/* Cash Position */}
        <div className={`rounded-2xl border p-6 lg:col-span-1 ${
          digest.cashPosition >= 0
            ? "bg-emerald-500/5 border-emerald-500/20"
            : "bg-red-500/5 border-red-500/20"
        }`}>
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm ${
              digest.cashPosition >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"
            }`}>
              💰
            </div>
            <div>
              <p className="text-xs text-gray-500">Cash Position</p>
              <p className="text-xs text-gray-500">Cleared transactions</p>
            </div>
          </div>
          <p className={`text-2xl font-bold ${digest.cashPosition >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {formatCurrency(digest.cashPosition)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {digest.cashPosition >= 0 ? "Positive cash position ✓" : "Negative — review expenses"}
          </p>
        </div>
      </div>

      {/* Outstanding Items */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Outstanding Items</h2>
          <p className="text-xs text-gray-500 mt-0.5">Things that need your attention</p>
        </div>

        <div className="divide-y divide-gray-800">
          {/* Overdue invoices */}
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full shrink-0 ${digest.overdueInvoices.count > 0 ? "bg-red-400" : "bg-emerald-400"}`} />
              <div>
                <p className="text-sm text-white">Overdue Invoices</p>
                <p className="text-xs text-gray-500">
                  {digest.overdueInvoices.count > 0
                    ? `${digest.overdueInvoices.count} invoice${digest.overdueInvoices.count !== 1 ? "s" : ""} — ${formatCurrency(digest.overdueInvoices.totalAmount)} outstanding`
                    : "All invoices up to date"}
                </p>
              </div>
            </div>
            <span className={`text-xs font-semibold ${digest.overdueInvoices.count > 0 ? "text-red-400" : "text-emerald-400"}`}>
              {digest.overdueInvoices.count > 0 ? "⚠ Action needed" : "✓ Clear"}
            </span>
          </div>

          {/* Unmatched payouts */}
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full shrink-0 ${digest.unmatchedPayouts > 0 ? "bg-amber-400" : "bg-emerald-400"}`} />
              <div>
                <p className="text-sm text-white">Unmatched OTA Payouts</p>
                <p className="text-xs text-gray-500">
                  {digest.unmatchedPayouts > 0
                    ? `${digest.unmatchedPayouts} payout item${digest.unmatchedPayouts !== 1 ? "s" : ""} need reconciliation`
                    : "All payouts matched"}
                </p>
              </div>
            </div>
            <span className={`text-xs font-semibold ${digest.unmatchedPayouts > 0 ? "text-amber-400" : "text-emerald-400"}`}>
              {digest.unmatchedPayouts > 0 ? "⚠ Review" : "✓ Clear"}
            </span>
          </div>

          {/* Property name */}
          <div className="px-6 py-4">
            <p className="text-xs text-gray-600">
              Digest for: <span className="text-gray-400">{firstProperty.name}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
