import { getBookings } from "@/lib/actions/bookings";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { PropertySwitcher } from "@/components/PropertySwitcher";
import { EmptyState } from "@/components/EmptyState";
import { BookingCard } from "@/components/BookingCard";
import { ExportButton } from "@/components/ExportButton";
import { formatCurrency, formatDate } from "@/lib/utils";
import { calcNights } from "@/lib/kpi";
import Link from "next/link";
import { BookingStatus, BookingSource } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Suspense } from "react";

interface PageProps {
  searchParams: Promise<{
    propertyId?: string;
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

  const session = await getServerSession(authOptions);
  const orgId = (session?.user as any)?.organisationId as string | undefined;

  // Load properties for the switcher
  const allProperties = orgId
    ? await prisma.property.findMany({
        where: { organisationId: orgId, isActive: true, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const { bookings, total, totalPages } = await getBookings({
    status,
    source,
    page,
    limit: 20,
    organisationId: orgId,
    // Only filter by property if explicitly selected
    propertyId: params.propertyId,
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

  // Prepare CSV data
  const csvData = bookings.map((b) => {
    let nights = 0;
    try { nights = calcNights(new Date(b.checkIn), new Date(b.checkOut)); } catch {}
    return {
      guestName: b.guestName,
      guestEmail: b.guestEmail ?? "",
      room: b.room.name,
      checkIn: formatDate(b.checkIn),
      checkOut: formatDate(b.checkOut),
      nights,
      source: b.source.replace(/_/g, " "),
      status: b.status.replace(/_/g, " "),
      netAmount: parseFloat(b.netAmount.toString()),
    };
  });

  return (
    <div>
      <PageHeader
        title="Bookings"
        description={`${total} booking${total !== 1 ? "s" : ""} total`}
        action={
          <div className="flex items-center gap-2">
            <Suspense fallback={null}>
              <PropertySwitcher properties={allProperties} currentPropertyId={params.propertyId ?? null} />
            </Suspense>
            <ExportButton data={csvData} filename="bookings-export" />
            <Link
              href="/bookings/new"
              className="px-4 py-2 rounded-xl text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
            >
              + New Booking
            </Link>
          </div>
        }
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

      {/* Empty state */}
      {bookings.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl">
          <EmptyState
            icon="📅"
            title="No bookings yet"
            message="Add your first booking to start tracking revenue."
            actionLabel="Add Booking"
            actionHref="/bookings/new"
          />
        </div>
      )}

      {/* Mobile: Card view */}
      {bookings.length > 0 && (
        <>
          <div className="md:hidden space-y-3 mb-4">
            {bookings.map((booking) => {
              let nights = 0;
              try { nights = calcNights(new Date(booking.checkIn), new Date(booking.checkOut)); } catch {}
              return (
                <BookingCard
                  key={booking.id}
                  id={booking.id}
                  guestName={booking.guestName}
                  guestEmail={booking.guestEmail}
                  checkIn={booking.checkIn}
                  checkOut={booking.checkOut}
                  nights={nights}
                  source={booking.source}
                  status={booking.status}
                  netAmount={booking.netAmount}
                  roomName={booking.room.name}
                />
              );
            })}
          </div>

          {/* Desktop: Table view */}
          <div className="hidden md:block bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
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
                  {bookings.map((booking) => {
                    let nights = 0;
                    try {
                      nights = calcNights(new Date(booking.checkIn), new Date(booking.checkOut));
                    } catch {}
                    return (
                      <tr key={booking.id} className="hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/bookings/${booking.id}`}>
                            <p className="text-white font-medium hover:text-emerald-400 transition-colors">{booking.guestName}</p>
                            {booking.guestEmail && (
                              <p className="text-xs text-gray-500">{booking.guestEmail}</p>
                            )}
                          </Link>
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
                  })}
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

          {/* Mobile pagination */}
          {totalPages > 1 && (
            <div className="md:hidden border-t border-gray-800 mt-4 pt-3 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Page {page} of {totalPages}
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
        </>
      )}
    </div>
  );
}
