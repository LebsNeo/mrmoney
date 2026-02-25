import Link from "next/link";
import { getOTAPayouts, getPayoutPlatformSummary } from "@/lib/actions/ota-payouts";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { OTAPlatform } from "@prisma/client";

interface PageProps {
  searchParams: Promise<{
    platform?: string;
    page?: string;
  }>;
}

const platformColors: Record<string, string> = {
  AIRBNB: "bg-red-500/10 text-red-400 border-red-500/20",
  BOOKING_COM: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  EXPEDIA: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  OTHER: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

export default async function OTAPayoutsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);
  const platform = params.platform as OTAPlatform | undefined;

  const [{ payouts, total, totalPages }, platformSummary] = await Promise.all([
    getOTAPayouts({ platform, page }),
    getPayoutPlatformSummary(),
  ]);

  function buildQuery(overrides: Record<string, string | undefined>) {
    const q = new URLSearchParams();
    if (platform) q.set("platform", platform);
    q.set("page", String(page));
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) q.delete(k);
      else q.set(k, v);
    }
    return q.toString() ? `?${q.toString()}` : "";
  }

  return (
    <div>
      <PageHeader
        title="OTA Payouts"
        description={`${total} payout${total !== 1 ? "s" : ""} imported`}
        action={
          <Link
            href="/ota-payouts/import"
            className="px-4 py-2 rounded-xl text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
          >
            Import CSV
          </Link>
        }
      />

      {/* Platform Summary Cards */}
      {platformSummary.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {platformSummary.map((ps) => (
            <div
              key={ps.platform}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    platformColors[ps.platform] ?? platformColors.OTHER
                  }`}
                >
                  {ps.platform.replace(/_/g, " ")}
                </span>
                <span className="text-gray-500 text-xs">{ps.count} payout{ps.count !== 1 ? "s" : ""}</span>
              </div>
              <div>
                <p className="text-xs text-gray-500">Gross</p>
                <p className="text-white font-semibold">{formatCurrency(ps.grossAmount)}</p>
              </div>
              <div className="flex justify-between text-xs">
                <div>
                  <p className="text-gray-500">Commission</p>
                  <p className="text-red-400">{formatCurrency(ps.totalCommission)}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-500">Net</p>
                  <p className="text-emerald-400 font-medium">{formatCurrency(ps.netAmount)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Platform Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          href={`/ota-payouts${buildQuery({ platform: undefined, page: "1" })}`}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            !platform ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-800 text-gray-400 hover:text-white"
          }`}
        >
          All Platforms
        </Link>
        {Object.values(OTAPlatform).map((p) => (
          <Link
            key={p}
            href={`/ota-payouts${buildQuery({ platform: p, page: "1" })}`}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              platform === p ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {p.replace(/_/g, " ")}
          </Link>
        ))}
      </div>

      {/* Payouts Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Platform</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Property</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Period</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Payout Date</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Items</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Gross</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Net</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {payouts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    No payouts imported yet.{" "}
                    <Link href="/ota-payouts/import" className="text-emerald-400 hover:text-emerald-300">
                      Import your first CSV
                    </Link>
                  </td>
                </tr>
              ) : (
                payouts.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                          platformColors[p.platform] ?? platformColors.OTHER
                        }`}
                      >
                        {p.platform.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{p.property.name}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {formatDate(p.periodStart)} – {formatDate(p.periodEnd)}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{formatDate(p.payoutDate)}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{p._count.items}</td>
                    <td className="px-4 py-3 text-right text-white">{formatCurrency(p.grossAmount)}</td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-400">
                      {formatCurrency(p.netAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={p.status.toLowerCase()} />
                        <Link
                          href={`/ota-payouts/${p.id}`}
                          className="text-xs text-gray-500 hover:text-emerald-400 transition-colors"
                        >
                          View →
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="border-t border-gray-800 px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Page {page} of {totalPages} · {total} results
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/ota-payouts${buildQuery({ page: String(page - 1) })}`}
                  className="px-3 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-300 hover:text-white"
                >
                  ← Prev
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/ota-payouts${buildQuery({ page: String(page + 1) })}`}
                  className="px-3 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-300 hover:text-white"
                >
                  Next →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
