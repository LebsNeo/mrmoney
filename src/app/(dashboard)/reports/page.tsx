import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

const REPORTS = [
  {
    href: "/reports/pl",
    icon: "📊",
    title: "Income Statement (P&L)",
    description: "Revenue, expenses, gross profit, EBITDA and net profit for any period.",
    badge: "Ready",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  {
    href: "/reports/balance-sheet",
    icon: "⚖️",
    title: "Balance Sheet",
    description: "Assets, liabilities and equity snapshot. Requires asset register setup.",
    badge: "Coming Soon",
    badgeColor: "bg-gray-700 text-gray-400 border-gray-600",
  },
  {
    href: "/reports/cash-flow",
    icon: "💧",
    title: "Cash Flow Statement",
    description: "Operating cash inflows and outflows for any period. Opening and closing cash position.",
    badge: "Ready",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  {
    href: "/reports/funding-pack",
    icon: "🏦",
    title: "Funding Pack",
    description: "Bank-ready export: 2yr financials, cash forecast, loan schedule, asset register, key ratios.",
    badge: "Coming Soon",
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
];

export default function ReportsPage() {
  return (
    <div>
      <PageHeader
        title="Financial Reports"
        description="Professional statements generated automatically from your data"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REPORTS.map((r) => {
          const isReady = r.badge === "Ready";
          const Card = (
            <div className={`bg-gray-900 border rounded-2xl p-6 transition-all h-full ${
              isReady
                ? "border-gray-700 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5 cursor-pointer"
                : "border-gray-800 opacity-60 cursor-not-allowed"
            }`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <span className="text-3xl">{r.icon}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${r.badgeColor}`}>
                  {r.badge}
                </span>
              </div>
              <h3 className="text-white font-semibold text-base mb-1">{r.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{r.description}</p>
              {isReady && (
                <p className="text-emerald-400 text-xs mt-4 font-medium">View Report →</p>
              )}
            </div>
          );

          return isReady ? (
            <Link key={r.href} href={r.href}>{Card}</Link>
          ) : (
            <div key={r.href}>{Card}</div>
          );
        })}
      </div>

      {/* Accounting basis note */}
      <p className="text-xs text-gray-600 mt-6 text-center">
        All reports use cash basis accounting · Figures exclude voided transactions
      </p>
    </div>
  );
}
