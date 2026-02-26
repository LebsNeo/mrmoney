import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { generateAlerts } from "@/lib/alerts";
import { getOverdueRecurring } from "@/lib/recurring";
import { markAlertRead, syncRecurringExpenses, toggleRecurringExpense } from "@/lib/actions/automation";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function AutomationPage() {
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

  const [alerts, recurringExpenses, overdueRecurring] = await Promise.all([
    generateAlerts(orgId),
    firstProperty
      ? prisma.recurringExpense.findMany({
          where: { propertyId: firstProperty.id, deletedAt: null },
          include: { vendor: { select: { name: true } } },
          orderBy: { nextExpectedDate: "asc" },
        })
      : Promise.resolve([]),
    firstProperty ? getOverdueRecurring(firstProperty.id) : Promise.resolve([]),
  ]);

  const overdueIds = new Set(overdueRecurring.map((r) => r.id));

  const priorityColors = {
    HIGH: "text-red-400 bg-red-500/10 border-red-500/20",
    MEDIUM: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    LOW: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  };

  const priorityIcon = {
    HIGH: "🔴",
    MEDIUM: "🟡",
    LOW: "🔵",
  };

  return (
    <div>
      <PageHeader
        title="Automation"
        description="Import, detect patterns, and manage alerts"
      />

      {/* 4 Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <Link
          href="/import/bank"
          className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:bg-gray-800 transition-colors group flex flex-col gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-lg">
            🏦
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Bank Import</p>
            <p className="text-xs text-gray-500 mt-0.5">FNB, ABSA, Nedbank, Standard Bank, Capitec</p>
          </div>
          <p className="text-xs text-emerald-400 group-hover:text-emerald-300 transition-colors mt-auto">
            Import CSV →
          </p>
        </Link>

        <Link
          href="/import/quickbooks"
          className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:bg-gray-800 transition-colors group flex flex-col gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 text-lg">
            📊
          </div>
          <div>
            <p className="text-sm font-semibold text-white">QuickBooks Import</p>
            <p className="text-xs text-gray-500 mt-0.5">Import QB transaction list export</p>
          </div>
          <p className="text-xs text-blue-400 group-hover:text-blue-300 transition-colors mt-auto">
            Import CSV →
          </p>
        </Link>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 text-lg">
            🔄
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Recurring Expenses</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {recurringExpenses.length} detected · {overdueRecurring.length} overdue
            </p>
          </div>
          {firstProperty && (
            <form action={async () => { "use server"; await syncRecurringExpenses(firstProperty.id); }}>
              <button
                type="submit"
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                Sync now →
              </button>
            </form>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 text-lg">
            🔔
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Alerts</p>
            <p className="text-xs text-gray-500 mt-0.5">{alerts.length} unread alert{alerts.length !== 1 ? "s" : ""}</p>
          </div>
          <p className="text-xs text-gray-500 mt-auto">See below ↓</p>
        </div>
      </div>

      {/* Recurring Expenses Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl mb-6">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Recurring Expenses</h2>
            <p className="text-xs text-gray-500 mt-0.5">Auto-detected from your transaction history</p>
          </div>
          <span className="text-xs text-gray-500">{recurringExpenses.length} detected</span>
        </div>

        {recurringExpenses.length === 0 ? (
          <p className="px-6 py-8 text-center text-gray-500 text-sm">
            No recurring expenses detected yet. Import transactions to get started.
          </p>
        ) : (
          <div className="divide-y divide-gray-800">
            {recurringExpenses.map((re) => {
              const isOverdue = overdueIds.has(re.id);
              return (
                <div key={re.id} className="px-6 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${isOverdue ? "text-orange-400" : "text-white"}`}>
                        {re.vendor?.name ?? re.category.replace(/_/g, " ")}
                        {isOverdue && (
                          <span className="ml-2 text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 px-1.5 py-0.5 rounded-md">
                            OVERDUE
                          </span>
                        )}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {re.frequency} · Next: {formatDate(re.nextExpectedDate)} · Avg: {formatCurrency(re.avgAmount)}
                    </p>
                  </div>
                  <form
                    action={async () => {
                      "use server";
                      await toggleRecurringExpense(re.id, !re.isActive);
                    }}
                  >
                    <button
                      type="submit"
                      className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                        re.isActive
                          ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20"
                          : "text-gray-500 border-gray-700 bg-gray-800 hover:bg-gray-700"
                      }`}
                    >
                      {re.isActive ? "Active" : "Inactive"}
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Alerts Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Alerts</h2>
            <p className="text-xs text-gray-500 mt-0.5">Sorted by priority</p>
          </div>
          <span className="text-xs text-gray-500">{alerts.length} unread</span>
        </div>

        {alerts.length === 0 ? (
          <EmptyState
            icon="✅"
            title="All clear!"
            message="No issues need your attention right now."
          />
        ) : (
          <div className="divide-y divide-gray-800">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`px-6 py-4 flex items-start justify-between gap-4 border-l-2 ${
                  alert.priority === "HIGH"
                    ? "border-l-red-500"
                    : alert.priority === "MEDIUM"
                    ? "border-l-amber-500"
                    : "border-l-blue-500"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{priorityIcon[alert.priority]}</span>
                    <p className="text-sm font-medium text-white">{alert.title}</p>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${priorityColors[alert.priority]}`}
                    >
                      {alert.priority}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{alert.message}</p>
                  {alert.actionUrl && (
                    <Link
                      href={alert.actionUrl}
                      className="text-xs text-emerald-400 hover:text-emerald-300 mt-1 inline-block"
                    >
                      View →
                    </Link>
                  )}
                </div>
                <form
                  action={async () => {
                    "use server";
                    await markAlertRead(alert.id);
                  }}
                >
                  <button
                    type="submit"
                    className="text-xs text-gray-500 hover:text-white transition-colors shrink-0"
                    title="Mark as read"
                  >
                    ✓ Done
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
