import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { PeriodSwitcher } from "@/components/PeriodSwitcher";
import { PropertySwitcher } from "@/components/PropertySwitcher";
import { getCashFlowStatement } from "@/lib/actions/reports";
import { PeriodPreset } from "@/lib/reports-utils";
import { formatCurrency } from "@/lib/utils";

interface Props {
  searchParams: Promise<{ period?: string; propertyId?: string; from?: string; to?: string }>;
}

export default async function CashFlowPage({ searchParams }: Props) {
  const params = await searchParams;
  const period = (params.period ?? "this_month") as PeriodPreset;
  const propertyId = params.propertyId;

  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organisationId?: string })?.organisationId;

  const properties = orgId
    ? await prisma.property.findMany({
        where: { organisationId: orgId, isActive: true, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const cf = await getCashFlowStatement(period, propertyId, params.from, params.to);

  const fmt = (n: number) =>
    n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const totalInflows = cf.operating.inflows.reduce((s, i) => s + i.amount, 0);
  const totalOutflows = cf.operating.outflows.reduce((s, o) => s + o.amount, 0);

  return (
    <div className="max-w-3xl">
      <div className="mb-2">
        <Link href="/reports" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          ← Reports
        </Link>
      </div>

      <PageHeader
        title="Cash Flow Statement"
        description={`Cash basis · ${cf.propertyName} · ${cf.currency}`}
        action={
          <div className="flex items-center gap-2">
            <PropertySwitcher properties={properties} currentPropertyId={propertyId} />
            <PeriodSwitcher />
          </div>
        }
      />

      {/* Period label */}
      <p className="text-sm text-gray-500 mb-6">{cf.periodLabel} — Cleared &amp; reconciled transactions only</p>

      {/* Opening cash */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl mb-4">
        <div className="px-6 py-4 flex justify-between items-center">
          <div>
            <p className="text-sm font-semibold text-white">Opening Cash Balance</p>
            <p className="text-xs text-gray-500 mt-0.5">Cumulative cleared position before this period</p>
          </div>
          <p className={`text-lg font-bold ${cf.openingCash >= 0 ? "text-white" : "text-red-400"}`}>
            {cf.openingCash < 0 ? "−" : ""}R {fmt(Math.abs(cf.openingCash))}
          </p>
        </div>
      </div>

      {/* Operating Inflows */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl mb-4 overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-800 bg-emerald-500/5">
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            Cash Inflows — Operating
          </p>
        </div>
        <div className="divide-y divide-gray-800/50">
          {cf.operating.inflows.length === 0 ? (
            <p className="px-6 py-4 text-gray-600 text-sm">No income transactions in this period</p>
          ) : (
            cf.operating.inflows.map(item => (
              <div key={item.label} className="px-6 py-3 flex justify-between items-center">
                <span className="text-sm text-gray-300">{item.label}</span>
                <span className="text-sm font-medium text-emerald-400">R {fmt(item.amount)}</span>
              </div>
            ))
          )}
        </div>
        <div className="px-6 py-3 border-t border-gray-700 bg-emerald-500/5 flex justify-between items-center">
          <span className="text-sm font-semibold text-white">Total Inflows</span>
          <span className="text-base font-bold text-emerald-400">R {fmt(totalInflows)}</span>
        </div>
      </div>

      {/* Operating Outflows */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl mb-4 overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-800 bg-red-500/5">
          <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">
            Cash Outflows — Operating
          </p>
        </div>
        <div className="divide-y divide-gray-800/50">
          {cf.operating.outflows.length === 0 ? (
            <p className="px-6 py-4 text-gray-600 text-sm">No expense transactions in this period</p>
          ) : (
            cf.operating.outflows.map(item => (
              <div key={item.label} className="px-6 py-3 flex justify-between items-center">
                <span className="text-sm text-gray-300">{item.label}</span>
                <span className="text-sm font-medium text-red-400">R {fmt(item.amount)}</span>
              </div>
            ))
          )}
        </div>
        <div className="px-6 py-3 border-t border-gray-700 bg-red-500/5 flex justify-between items-center">
          <span className="text-sm font-semibold text-white">Total Outflows</span>
          <span className="text-base font-bold text-red-400">R {fmt(totalOutflows)}</span>
        </div>
      </div>

      {/* Net movement */}
      <div className={`rounded-2xl border p-6 mb-4 flex justify-between items-center ${
        cf.operating.netOperating >= 0
          ? "bg-emerald-500/5 border-emerald-500/20"
          : "bg-red-500/5 border-red-500/20"
      }`}>
        <div>
          <p className="text-sm font-semibold text-white">Net Cash from Operations</p>
          <p className="text-xs text-gray-500 mt-0.5">Total inflows minus total outflows</p>
        </div>
        <p className={`text-2xl font-bold ${cf.operating.netOperating >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {cf.operating.netOperating < 0 ? "−" : "+"}R {fmt(Math.abs(cf.operating.netOperating))}
        </p>
      </div>

      {/* Closing cash */}
      <div className={`rounded-2xl border p-6 flex justify-between items-center ${
        cf.closingCash >= 0 ? "border-gray-700 bg-gray-900" : "bg-red-500/5 border-red-500/20"
      }`}>
        <div>
          <p className="text-sm font-semibold text-white">Closing Cash Balance</p>
          <p className="text-xs text-gray-500 mt-0.5">Opening {cf.openingCash < 0 ? "−" : ""}R {fmt(Math.abs(cf.openingCash))} {cf.operating.netOperating >= 0 ? "+" : "−"} R {fmt(Math.abs(cf.operating.netOperating))}</p>
        </div>
        <p className={`text-2xl font-bold ${cf.closingCash >= 0 ? "text-white" : "text-red-400"}`}>
          {cf.closingCash < 0 ? "−" : ""}R {fmt(Math.abs(cf.closingCash))}
        </p>
      </div>

      <p className="text-xs text-gray-700 mt-6 text-center">
        Cash basis · Only cleared &amp; reconciled transactions · Pending transactions excluded
      </p>
    </div>
  );
}
