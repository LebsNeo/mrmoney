import { notFound } from "next/navigation";
import Link from "next/link";
import { getOTAPayoutById } from "@/lib/actions/ota-payouts";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ManualMatchButton } from "@/components/ManualMatchButton";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";
import { detectRevenueLeakage, calcNights } from "@/lib/kpi";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OTAPayoutDetailPage({ params }: PageProps) {
  const { id } = await params;
  const payout = await getOTAPayoutById(id);
  if (!payout) notFound();

  const gross = toNumber(payout.grossAmount);
  const commission = toNumber(payout.totalCommission);
  const net = toNumber(payout.netAmount);

  const matchedItems = payout.items.filter((i) => i.isMatched);
  const unmatchedItems = payout.items.filter((i) => !i.isMatched);

  // Reconciliation: expected = sum of matched booking net amounts
  const expectedPayouts = matchedItems.reduce((sum, item) => {
    if (item.booking) {
      return sum + toNumber(item.booking.netAmount);
    }
    return sum + toNumber(item.netAmount);
  }, 0);

  const { leakage, leakagePercent } = detectRevenueLeakage(expectedPayouts, net);

  const platformColors: Record<string, string> = {
    AIRBNB: "bg-red-500/10 text-red-400 border-red-500/20",
    BOOKING_COM: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    EXPEDIA: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    OTHER: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  };

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
        <Link href="/ota-payouts" className="hover:text-white transition-colors">
          OTA Payouts
        </Link>
        <span>/</span>
        <span className="text-white">
          {payout.platform.replace(/_/g, " ")} · {formatDate(payout.payoutDate)}
        </span>
      </div>

      <PageHeader
        title={`${payout.platform.replace(/_/g, " ")} Payout`}
        description={`${payout.property.name} · ${formatDate(payout.periodStart)} – ${formatDate(payout.periodEnd)}`}
        action={
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                platformColors[payout.platform] ?? platformColors.OTHER
              }`}
            >
              {payout.platform.replace(/_/g, " ")}
            </span>
            <StatusBadge status={payout.status.toLowerCase()} />
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Payout Summary */}
        <div className="lg:col-span-2 grid grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-xs text-gray-500 mb-2">Gross Payout</p>
            <p className="text-xl font-bold text-white">{formatCurrency(gross)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-xs text-gray-500 mb-2">Commission</p>
            <p className="text-xl font-bold text-red-400">{formatCurrency(commission)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-xs text-gray-500 mb-2">Net Received</p>
            <p className="text-xl font-bold text-emerald-400">{formatCurrency(net)}</p>
          </div>
        </div>

        {/* Match Summary */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Matching
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Total Items</span>
              <span className="text-white font-medium">{payout.items.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-emerald-400">✓ Matched</span>
              <span className="text-emerald-400 font-medium">{matchedItems.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-orange-400">⚠ Unmatched</span>
              <span className="text-orange-400 font-medium">{unmatchedItems.length}</span>
            </div>
            {payout.importFilename && (
              <p className="text-xs text-gray-600 pt-2 border-t border-gray-800 truncate">
                {payout.importFilename}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Reconciliation Panel */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Reconciliation
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Expected (from bookings)</p>
            <p className="text-lg font-bold text-white">{formatCurrency(expectedPayouts)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Actual (OTA net)</p>
            <p className="text-lg font-bold text-emerald-400">{formatCurrency(net)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Leakage / Difference</p>
            <p className={`text-lg font-bold ${leakage > 0 ? "text-red-400" : leakage < 0 ? "text-yellow-400" : "text-gray-400"}`}>
              {leakage > 0 ? "−" : leakage < 0 ? "+" : ""}
              {formatCurrency(Math.abs(leakage))}
              {leakage !== 0 && (
                <span className="text-sm font-normal ml-1 opacity-70">
                  ({Math.abs(leakagePercent).toFixed(1)}%)
                </span>
              )}
            </p>
          </div>
        </div>
        {leakage > 0 && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            ⚠ Revenue leakage detected: {formatCurrency(leakage)} ({leakagePercent.toFixed(1)}%) less than expected.
            Review unmatched items and verify all bookings are recorded.
          </div>
        )}
        {leakage === 0 && matchedItems.length > 0 && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
            ✓ Payout reconciles perfectly with recorded bookings.
          </div>
        )}
      </div>

      {/* Payout Items */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Payout Line Items ({payout.items.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Ref</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Guest</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Check-in</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Check-out</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Gross</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Commission</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Net</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Match</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {payout.items.map((item) => (
                <tr
                  key={item.id}
                  className={`transition-colors ${
                    item.isMatched
                      ? "hover:bg-emerald-500/5"
                      : "hover:bg-orange-500/5"
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-gray-400">{item.externalBookingRef}</span>
                  </td>
                  <td className="px-4 py-3 text-white">{item.guestName}</td>
                  <td className="px-4 py-3 text-gray-300 text-xs">{formatDate(item.checkIn)}</td>
                  <td className="px-4 py-3 text-gray-300 text-xs">{formatDate(item.checkOut)}</td>
                  <td className="px-4 py-3 text-right text-white">{formatCurrency(item.grossAmount)}</td>
                  <td className="px-4 py-3 text-right text-red-400">{formatCurrency(item.commission)}</td>
                  <td className="px-4 py-3 text-right font-medium text-emerald-400">
                    {formatCurrency(item.netAmount)}
                  </td>
                  <td className="px-4 py-3">
                    {item.isMatched ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          ✓ Matched
                        </span>
                        {item.booking && (
                          <Link
                            href={`/bookings/${item.booking.id}`}
                            className="text-xs text-gray-500 hover:text-emerald-400 transition-colors"
                          >
                            {item.booking.guestName}
                          </Link>
                        )}
                      </div>
                    ) : (
                      <ManualMatchButton
                        payoutItemId={item.id}
                        guestName={item.guestName}
                        checkIn={formatDate(item.checkIn)}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
