import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

const REPORTS = [
  {
    href: "/reports/pl",
    icon: "📊",
    title: "Income Statement (P&L)",
    description: "Revenue, costs, gross profit, EBITDA and net profit for any period",
    badge: "Available",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  {
    href: "/reports/balance-sheet",
    icon: "⚖️",
    title: "Balance Sheet",
    description: "Assets, liabilities and equity snapshot",
    badge: "Coming Soon",
    badgeColor: "bg-gray-700 text-gray-500 border-gray-700",
  },
  {
    href: "/reports/cash-flow",
    icon: "💸",
    title: "Cash Flow Statement",
    description: "Operating, investing and financing cash movements",
    badge: "Coming Soon",
    badgeColor: "bg-gray-700 text-gray-500 border-gray-700",
  },
  {
    href: "/reports/funding-pack",
    icon: "🏦",
    title: "Funding Pack",
    description: "Bank-ready pack: 2yr financials, forecasts, loan schedule, key ratios",
    badge: "Coming Soon",
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
];

export default function ReportsPage() {
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Professional financial statements — cash basis, hospitality-optimised"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REPORTS.map((r) => {
          const isAvailable = r.badge === "Available";
          const card = (
            <div className={`bg-gray-900 border rounded-2xl p-5 transition-all ${
              isAvailable
                ? "border-gray-800 hover:border-emerald-500/40 cursor-pointer group"
                : "border-gray-800 opacity-60"
            }`}>
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">{r.icon}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${r.badgeColor}`}>
                  {r.badge}
                </span>
              </div>
              <h3 className={`font-semibold text-sm mb-1 transition-colors ${
                isAvailable ? "text-white group-hover:text-emerald-400" : "text-gray-400"
              }`}>
                {r.title}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">{r.description}</p>
            </div>
          );

          return isAvailable ? (
            <Link key={r.href} href={r.href}>{card}</Link>
          ) : (
            <div key={r.href}>{card}</div>
          );
        })}
      </div>

      <p className="text-xs text-gray-600 mt-6 text-center">
        All statements use cash basis accounting · Figures in ZAR
      </p>
    </div>
  );
}
