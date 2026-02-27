"use client";

import type { PLStatement } from "@/lib/actions/reports";

function formatR(n: number) {
  const abs = Math.abs(n);
  const str = abs.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(R ${str})` : `R ${str}`;
}

function pct(n: number) {
  return `${n >= 0 ? "" : ""}${n.toFixed(1)}%`;
}

interface SummaryRowProps {
  label: string;
  amount: number;
  margin?: number;
  highlight?: "profit" | "loss" | "neutral";
  size?: "normal" | "large";
  border?: boolean;
}

function SummaryRow({ label, amount, margin, highlight, size = "normal", border }: SummaryRowProps) {
  const isLoss = amount < 0;
  const color =
    highlight === "profit" ? (isLoss ? "text-red-400" : "text-emerald-400")
    : highlight === "loss"  ? "text-red-400"
    : "text-white";

  return (
    <div className={`flex items-center justify-between py-2 ${border ? "border-t border-gray-700 mt-1" : ""}`}>
      <span className={`font-semibold ${size === "large" ? "text-base" : "text-sm"} text-white`}>
        {label}
      </span>
      <div className="flex items-center gap-4">
        {margin !== undefined && (
          <span className={`text-xs font-medium ${amount >= 0 ? "text-emerald-400/70" : "text-red-400/70"}`}>
            {pct(margin)}
          </span>
        )}
        <span className={`font-bold ${size === "large" ? "text-lg" : "text-sm"} ${color} min-w-[140px] text-right`}>
          {formatR(amount)}
        </span>
      </div>
    </div>
  );
}

interface LineRowProps {
  label: string;
  amount: number;
  txCount: number;
}

function LineRow({ label, amount, txCount }: LineRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5 group">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-300">{label}</span>
        <span className="text-[10px] text-gray-600 group-hover:text-gray-500">
          {txCount} {txCount === 1 ? "txn" : "txns"}
        </span>
      </div>
      <span className="text-sm text-gray-200 min-w-[140px] text-right font-medium">
        {formatR(amount)}
      </span>
    </div>
  );
}

export function PLStatementView({ pl }: { pl: PLStatement }) {
  if (pl.totalRevenue === 0 && pl.totalCOGS === 0 && pl.totalOpEx === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
        <p className="text-4xl mb-3">📊</p>
        <p className="text-white font-semibold mb-1">No transactions found</p>
        <p className="text-sm text-gray-500">
          No cleared transactions for {pl.periodLabel}
          {pl.propertyName !== "All Properties" ? ` · ${pl.propertyName}` : ""}.
        </p>
        <p className="text-xs text-gray-600 mt-2">Try a different period or import your bank statements first.</p>
      </div>
    );
  }

  return (
    <>
      {/* Print toolbar */}
      <div className="flex items-center justify-between mb-4 print:hidden">
        <div className="text-xs text-gray-500">
          Cash basis · Generated {new Date(pl.generatedAt).toLocaleString("en-ZA")}
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-800 border border-gray-700 text-gray-300 hover:text-white transition-colors"
        >
          🖨️ Print / Export PDF
        </button>
      </div>

      {/* Statement */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden print:border-0 print:rounded-none print:bg-white">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-800 print:border-gray-300">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-white print:text-black">Income Statement</h2>
              <p className="text-sm text-gray-400 mt-0.5 print:text-gray-600">{pl.propertyName}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-white print:text-black">{pl.periodLabel}</p>
              <p className="text-xs text-gray-500 mt-0.5 print:text-gray-500">Cash Basis · ZAR</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 space-y-6 print:text-black">

          {/* ── REVENUE ─────────────────────────────── */}
          {pl.groups.find(g => g.group === "REVENUE") && (() => {
            const g = pl.groups.find(g => g.group === "REVENUE")!;
            return (
              <div>
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2 print:text-emerald-700">
                  Revenue
                </p>
                <div className="divide-y divide-gray-800/50 print:divide-gray-200">
                  {g.lines.map(l => <LineRow key={l.category} {...l} />)}
                </div>
                <div className="border-t border-gray-700 mt-2 pt-2 print:border-gray-300">
                  <SummaryRow label="Total Revenue" amount={pl.totalRevenue} />
                </div>
              </div>
            );
          })()}

          {/* ── COST OF SALES ──────────────────────── */}
          {pl.groups.find(g => g.group === "COST_OF_SALES" && g.lines.length > 0) && (() => {
            const g = pl.groups.find(g => g.group === "COST_OF_SALES")!;
            return (
              <div>
                <p className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-2 print:text-orange-700">
                  Cost of Sales
                </p>
                <div className="divide-y divide-gray-800/50 print:divide-gray-200">
                  {g.lines.map(l => <LineRow key={l.category} {...l} />)}
                </div>
                <div className="border-t border-gray-700 mt-2 pt-2 print:border-gray-300">
                  <SummaryRow label="Total Cost of Sales" amount={pl.totalCOGS} />
                </div>
              </div>
            );
          })()}

          {/* ── GROSS PROFIT ───────────────────────── */}
          <div className="bg-gray-800/50 rounded-xl px-4 py-3 print:bg-gray-100">
            <SummaryRow
              label="Gross Profit"
              amount={pl.grossProfit}
              margin={pl.grossMargin}
              highlight="profit"
              size="large"
            />
          </div>

          {/* ── OPERATING EXPENSES ─────────────────── */}
          {pl.groups.find(g => g.group === "OPERATING_EXPENSES" && g.lines.length > 0) && (() => {
            const g = pl.groups.find(g => g.group === "OPERATING_EXPENSES")!;
            return (
              <div>
                <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2 print:text-blue-700">
                  Operating Expenses
                </p>
                <div className="divide-y divide-gray-800/50 print:divide-gray-200">
                  {g.lines.map(l => <LineRow key={l.category} {...l} />)}
                </div>
                <div className="border-t border-gray-700 mt-2 pt-2 print:border-gray-300">
                  <SummaryRow label="Total Operating Expenses" amount={pl.totalOpEx} />
                </div>
              </div>
            );
          })()}

          {/* ── EBITDA ─────────────────────────────── */}
          <div className="bg-gray-800/50 rounded-xl px-4 py-3 print:bg-gray-100">
            <SummaryRow
              label="Operating Profit (EBITDA)"
              amount={pl.ebitda}
              margin={pl.ebitdaMargin}
              highlight="profit"
              size="large"
            />
          </div>

          {/* ── FINANCIAL CHARGES ──────────────────── */}
          {pl.groups.find(g => g.group === "FINANCIAL_CHARGES" && g.lines.length > 0) && (() => {
            const g = pl.groups.find(g => g.group === "FINANCIAL_CHARGES")!;
            return (
              <div>
                <p className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2 print:text-purple-700">
                  Financial Charges
                </p>
                <div className="divide-y divide-gray-800/50 print:divide-gray-200">
                  {g.lines.map(l => <LineRow key={l.category} {...l} />)}
                </div>
                <div className="border-t border-gray-700 mt-2 pt-2 print:border-gray-300">
                  <SummaryRow label="Total Financial Charges" amount={pl.totalFinancial} />
                </div>
              </div>
            );
          })()}

          {/* ── NET PROFIT ─────────────────────────── */}
          <div className={`rounded-xl px-4 py-4 border-2 ${
            pl.netProfit >= 0
              ? "bg-emerald-500/10 border-emerald-500/30 print:bg-emerald-50 print:border-emerald-300"
              : "bg-red-500/10 border-red-500/30 print:bg-red-50 print:border-red-300"
          }`}>
            <SummaryRow
              label={pl.netProfit >= 0 ? "Net Profit" : "Net Loss"}
              amount={pl.netProfit}
              margin={pl.netMargin}
              highlight="profit"
              size="large"
            />
          </div>

          {/* Quick summary pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 print:hidden">
            {[
              { label: "Revenue", value: formatR(pl.totalRevenue), color: "text-emerald-400" },
              { label: "Gross Margin", value: pct(pl.grossMargin), color: pl.grossMargin >= 0 ? "text-emerald-400" : "text-red-400" },
              { label: "EBITDA Margin", value: pct(pl.ebitdaMargin), color: pl.ebitdaMargin >= 0 ? "text-emerald-400" : "text-red-400" },
              { label: "Net Margin", value: pct(pl.netMargin), color: pl.netMargin >= 0 ? "text-emerald-400" : "text-red-400" },
            ].map(s => (
              <div key={s.label} className="bg-gray-800 rounded-xl p-3 text-center">
                <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <p className="text-[10px] text-gray-600 text-center pb-2 print:text-gray-400">
            Cash basis · Cleared and reconciled transactions only · Generated by MrMoney
          </p>
        </div>
      </div>
    </>
  );
}
