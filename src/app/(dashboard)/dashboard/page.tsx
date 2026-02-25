import { getDashboardKPIs } from "@/lib/actions/dashboard";
import { KPICard } from "@/components/KPICard";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { formatCurrency, formatDate, formatPercent } from "@/lib/utils";
import { calcNights as computeNights } from "@/lib/kpi";

export default async function DashboardPage() {
  const data = await getDashboardKPIs();

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Overview for ${formatDate(data.period.start, "MMMM yyyy")}`}
      />

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <KPICard
          label="Total Revenue"
          value={formatCurrency(data.totalRevenue)}
          subValue="Net (after OTA commission)"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        <KPICard
          label="Occupancy Rate"
          value={formatPercent(data.occupancyRate)}
          subValue={`${data.occupiedRoomNights} of ${data.totalRooms * new Date().getDate()} available nights`}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
            </svg>
          }
        />

        <KPICard
          label="ADR"
          value={formatCurrency(data.adr)}
          subValue="Average Daily Rate"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          }
        />

        <KPICard
          label="RevPAR"
          value={formatCurrency(data.revpar)}
          subValue="Revenue Per Available Room"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
            </svg>
          }
        />
      </div>

      {/* Cash Position Banner */}
      <div className={`rounded-2xl border p-6 mb-8 flex items-center justify-between ${
        data.cashPosition >= 0
          ? "bg-emerald-500/5 border-emerald-500/20"
          : "bg-red-500/5 border-red-500/20"
      }`}>
        <div>
          <p className="text-sm text-gray-400 mb-1">Cash Position (Cleared)</p>
          <p className={`text-3xl font-bold ${data.cashPosition >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {formatCurrency(data.cashPosition)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Cleared income minus cleared expenses</p>
        </div>
        <div className={`p-4 rounded-xl ${data.cashPosition >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
          <svg className={`w-8 h-8 ${data.cashPosition >= 0 ? "text-emerald-400" : "text-red-400"}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" />
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">Recent Transactions</h2>
            <p className="text-xs text-gray-500 mt-0.5">Last 10 transactions</p>
          </div>
          <div className="divide-y divide-gray-800">
            {data.recentTransactions.length === 0 ? (
              <p className="px-6 py-8 text-center text-gray-500 text-sm">No transactions yet</p>
            ) : (
              data.recentTransactions.map((tx) => (
                <div key={tx.id} className="px-6 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{tx.description}</p>
                    <p className="text-xs text-gray-500">{tx.category.replace(/_/g, " ")} · {formatDate(tx.date)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${tx.type === "INCOME" ? "text-emerald-400" : "text-red-400"}`}>
                      {tx.type === "INCOME" ? "+" : "-"}{formatCurrency(tx.amount)}
                    </p>
                    <StatusBadge status={tx.status.toLowerCase()} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Bookings */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">Upcoming Check-ins</h2>
            <p className="text-xs text-gray-500 mt-0.5">Next 7 days</p>
          </div>
          <div className="divide-y divide-gray-800">
            {data.upcomingBookings.length === 0 ? (
              <p className="px-6 py-8 text-center text-gray-500 text-sm">No upcoming check-ins</p>
            ) : (
              data.upcomingBookings.map((booking) => {
                let nights = 0;
                try {
                  nights = computeNights(new Date(booking.checkIn), new Date(booking.checkOut));
                } catch {}
                return (
                  <div key={booking.id} className="px-6 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{booking.guestName}</p>
                      <p className="text-xs text-gray-500">
                        {booking.room.name} · {formatDate(booking.checkIn)} · {nights}n
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <StatusBadge status={booking.status.toLowerCase()} />
                      <p className="text-xs text-gray-500 mt-1">{booking.source.replace(/_/g, " ")}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
