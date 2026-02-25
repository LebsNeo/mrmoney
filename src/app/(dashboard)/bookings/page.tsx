import { getBookings } from "@/lib/actions/bookings";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { formatCurrency, formatDate } from "@/lib/utils";
import { calcNights } from "@/lib/kpi";
import Link from "next/link";
import { BookingStatus, BookingSource } from "@prisma/client";

interface PageProps {
  searchParams: Promise<{
    status?: string;
    source?: string;
    page?: string;
  }>;
}

export default async function BookingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);
  const status = params.status as BookingStatus | undefined;
  const source = params.source as BookingSource | undefined;

  const { bookings, total, totalPages } = await getBookings({
    status,
    source,
    page,
    limit: 20,
  });

  function buildQuery(overrides: Record<string, string | undefined>) {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (source) q.set("source", source);
    q.set("page", String(page));
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) q.delete(k);
      else q.set(k, v);
    }
    return q.toString() ? `?${q.toString()}` : "";
  }

  const statusOptions = Object.values(BookingStatus);
  const sourceOptions = Object.values(BookingSource);

  return (
    <div>
      <PageHeader
        title="Bookings"
        description={`${total} booking${total !== 1 ? "s" : ""} total`}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400 font-medium">Status:</label>
          <div className="flex flex-wrap gap-1">
            <Link
              href={`/bookings${buildQuery({ status: undefined, page: "1" })}`}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                !status ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              All
            </Link>
            {statusOptions.map((s) => (
              <Link
                key={s}
                href={`/bookings${buildQuery({ status: s, page: "1" })}`}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  status === s ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                {s.replace(/_/g, " ")}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400 font-medium">Source:</label>
          <div className="flex flex-wrap gap-1">
            <Link
              href={`/bookings${buildQuery({ source: undefined, page: "1" })}`}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                !source ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              All
            </Link>
            {sourceOptions.map((s) => (
              <Link
                key={s}
                href={`/bookings${buildQuery({ source: s, page: "1" })}`}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  source === s ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                {s.replace(/_/g, " ")}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Guest</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Room</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Check-in</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Check-out</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Nights</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Source</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Net Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    No bookings found
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => {
                  let nights = 0;
                  try {
                    nights = calcNights(new Date(booking.checkIn), new Date(booking.checkOut));
                  } catch {}
                  return (
                    <tr key={booking.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-white font-medium">{booking.guestName}</p>
                          {booking.guestEmail && (
                            <p className="text-xs text-gray-500">{booking.guestEmail}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{booking.room.name}</td>
                      <td className="px-4 py-3 text-gray-300">{formatDate(booking.checkIn)}</td>
                      <td className="px-4 py-3 text-gray-300">{formatDate(booking.checkOut)}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{nights}</td>
                      <td className="px-4 py-3">
                        <span className="text-gray-400 text-xs">{booking.source.replace(/_/g, " ")}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={booking.status.toLowerCase()} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-white">
                        {formatCurrency(booking.netAmount)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-gray-800 px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Page {page} of {totalPages} · {total} results
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/bookings${buildQuery({ page: String(page - 1) })}`}
                  className="px-3 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-300 hover:text-white transition-colors"
                >
                  ← Prev
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/bookings${buildQuery({ page: String(page + 1) })}`}
                  className="px-3 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-300 hover:text-white transition-colors"
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
