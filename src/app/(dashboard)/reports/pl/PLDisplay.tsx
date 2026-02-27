"use client";

import { PLStatement, PLSection, PLLineItem } from "@/lib/coa";

function fmtAmt(n: number, currency = "ZAR") {
  if (n === 0) return "—";
  return `R ${Math.abs(n).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(n: number) {
  if (!isFinite(n) || n === 0) return "";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function SectionRows({ section }: { section: PLSection }) {
  if (section.lines.length === 0) {
    return (
      <tr>
        <td className="px-4 py-2 text-xs text-gray-600 italic" colSpan={2}>No transactions recorded</td>
      </tr>
    );
  }
  return (
    <>
      {section.lines.map((line) => (
        <tr key={`${line.category}-${line.amount}`} className="group">
          <td className="px-4 py-2 text-sm text-gray-300 pl-8">{line.label}</td>
          <td className="px-4 py-2 text-sm text-right text-gray-300 font-mono">
            {fmtAmt(line.amount)}
          </td>
        </tr>
      ))}
    </>
  );
}

function SectionHeader({ title, color }: { title: string; color: string }) {
  return (
    <tr className="border-t border-gray-800">
      <td className={`px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-${color}-400`} colSpan={2}>
        {title}
      </td>
    </tr>
  );
}

function SectionTotal({ label, amount, bold = false, highlight = false, marginPct }: {
  label: string;
  amount: number;
  bold?: boolean;
  highlight?: boolean;
  marginPct?: number;
}) {
  const isPositive = amount >= 0;
  const color = highlight
    ? isPositive ? "text-emerald-400" : "text-red-400"
    : "text-white";

  return (
    <tr className={`border-t border-gray-700 ${highlight ? "bg-gray-800/50" : ""}`}>
      <td className={`px-4 py-3 text-sm ${bold ? "font-bold" : "font-semibold"} ${color}`}>
        {label}
        {marginPct !== undefined && isFinite(marginPct) && (
          <span className={`ml-2 text-xs font-normal px-1.5 py-0.5 rounded ${
            marginPct >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
          }`}>
            {pct(marginPct)}
          </span>
        )}
      </td>
      <td className={`px-4 py-3 text-sm text-right font-mono ${bold ? "font-bold" : "font-semibold"} ${color}`}>
        {amount < 0 && <span className="text-red-400 mr-1">(</span>}
        {fmtAmt(amount)}
        {amount < 0 && <span className="text-red-400 ml-0.5">)</span>}
      </td>
    </tr>
  );
}

export function PLDisplay({ pl }: { pl: PLStatement }) {
  const hasData = pl.totalRevenue > 0 || pl.totalExpenses > 0;

  return (
    <div className="space-y-4">
      {/* Statement card */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden" id="pl-statement">

        {/* Statement header */}
        <div className="px-6 py-5 border-b border-gray-800 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-white font-bold text-lg">Income Statement</h2>
            <p className="text-gray-400 text-sm mt-0.5">{pl.propertyName}</p>
            <p className="text-gray-500 text-xs mt-1">{pl.periodLabel}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-600">Generated</p>
            <p className="text-xs text-gray-500">{pl.generatedAt.toLocaleDateString("en-ZA")}</p>
            <p className="text-[10px] text-gray-600 mt-1">Cash Basis · ZAR</p>
          </div>
        </div>

        {!hasData ? (
          <div className="px-6 py-16 text-center">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-white font-medium">No transactions in this period</p>
            <p className="text-gray-500 text-sm mt-1">Record income and expenses to generate your P&L</p>
          </div>
        ) : (
          <table className="w-full">
            <tbody>
              {/* ── REVENUE ── */}
              <SectionHeader title="Revenue" color="emerald" />
              <SectionRows section={pl.revenue} />
              <SectionTotal
                label="Total Revenue"
                amount={pl.revenue.total}
                bold
              />

              {/* ── COST OF SALES ── */}
              {pl.costOfSales.lines.length > 0 && (
                <>
                  <SectionHeader title="Cost of Sales" color="amber" />
                  <SectionRows section={pl.costOfSales} />
                  <SectionTotal label="Total Cost of Sales" amount={pl.costOfSales.total} />
                </>
              )}

              {/* ── GROSS PROFIT ── */}
              <SectionTotal
                label="Gross Profit"
                amount={pl.grossProfit}
                bold
                highlight
                marginPct={pl.grossMargin}
              />

              {/* ── OPERATING EXPENSES ── */}
              {pl.operatingExpenses.lines.length > 0 && (
                <>
                  <SectionHeader title="Operating Expenses" color="red" />
                  <SectionRows section={pl.operatingExpenses} />
                  <SectionTotal label="Total Operating Expenses" amount={pl.operatingExpenses.total} />
                </>
              )}

              {/* ── EBITDA ── */}
              <SectionTotal
                label="Operating Profit (EBITDA)"
                amount={pl.ebitda}
                bold
                highlight
                marginPct={pl.ebitdaMargin}
              />

              {/* ── FINANCIAL CHARGES ── */}
              {pl.financialCharges.lines.length > 0 && (
                <>
                  <SectionHeader title="Financial Charges" color="orange" />
                  <SectionRows section={pl.financialCharges} />
                  <SectionTotal label="Total Financial Charges" amount={pl.financialCharges.total} />
                </>
              )}

              {/* ── NET PROFIT ── */}
              <SectionTotal
                label="Net Profit"
                amount={pl.netProfit}
                bold
                highlight
                marginPct={pl.netMargin}
              />
            </tbody>
          </table>
        )}
      </div>

      {/* KPI summary cards */}
      {hasData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Revenue", value: `R ${pl.totalRevenue.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, color: "emerald" },
            { label: "Gross Margin", value: `${pl.grossMargin.toFixed(1)}%`, color: pl.grossMargin >= 0 ? "emerald" : "red" },
            { label: "EBITDA Margin", value: `${pl.ebitdaMargin.toFixed(1)}%`, color: pl.ebitdaMargin >= 0 ? "emerald" : "red" },
            { label: "Net Margin", value: `${pl.netMargin.toFixed(1)}%`, color: pl.netMargin >= 0 ? "emerald" : "red" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
              <p className={`text-xl font-bold text-${kpi.color}-400`}>{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {hasData && (
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl text-sm bg-gray-800 border border-gray-700 text-gray-300 hover:text-white transition-colors"
          >
            🖨️ Print / PDF
          </button>
        </div>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #pl-statement { display: block !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
