import { notFound } from "next/navigation";
import Link from "next/link";
import { getBookingById } from "@/lib/actions/bookings";
import { StatusBadge } from "@/components/StatusBadge";
import { BookingActions } from "@/components/BookingActions";
import { PageHeader } from "@/components/PageHeader";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";
import { calcNights } from "@/lib/kpi";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BookingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const booking = await getBookingById(id);

  if (!booking) notFound();

  let nights = 0;
  try {
    nights = calcNights(new Date(booking.checkIn), new Date(booking.checkOut));
  } catch {}

  const gross = toNumber(booking.grossAmount);
  const commission = toNumber(booking.otaCommission);
  const net = toNumber(booking.netAmount);
  const vatAmount = toNumber(booking.vatAmount);
  const vatRate = toNumber(booking.vatRate);
  const total = booking.isVatInclusive ? gross : gross + vatAmount;

  const invoice = booking.invoices?.[0];
  const transactions = booking.transactions ?? [];

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
        <Link href="/bookings" className="hover:text-white transition-colors">
          Bookings
        </Link>
        <span>/</span>
        <span className="text-white">{booking.guestName}</span>
      </div>

      <PageHeader
        title={booking.guestName}
        description={`${booking.property.name} · ${booking.room.name}`}
        action={<StatusBadge status={booking.status.toLowerCase()} className="text-sm px-3 py-1" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Guest & Stay Info */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Booking Details
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Guest Name</p>
                <p className="text-white font-medium">{booking.guestName}</p>
              </div>
              {booking.guestEmail && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Email</p>
                  <p className="text-white">{booking.guestEmail}</p>
                </div>
              )}
              {booking.guestPhone && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Phone</p>
                  <p className="text-white">{booking.guestPhone}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 mb-1">Source</p>
                <p className="text-white">{booking.source.replace(/_/g, " ")}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Property</p>
                <p className="text-white">{booking.property.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Room</p>
                <p className="text-white">
                  {booking.room.name}{" "}
                  <span className="text-gray-500 text-xs">({booking.room.type})</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Check-in</p>
                <p className="text-white">{formatDate(booking.checkIn)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Check-out</p>
                <p className="text-white">{formatDate(booking.checkOut)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Nights</p>
                <p className="text-white font-bold">{nights}</p>
              </div>
              {booking.externalRef && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">External Ref</p>
                  <p className="text-white font-mono text-sm">{booking.externalRef}</p>
                </div>
              )}
            </div>
            {booking.notes && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <p className="text-xs text-gray-500 mb-1">Notes</p>
                <p className="text-gray-300 text-sm">{booking.notes}</p>
              </div>
            )}
          </div>

          {/* Financial Breakdown */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Financial Breakdown
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Gross Amount</span>
                <span className="text-white font-medium">{formatCurrency(gross)}</span>
              </div>
              {commission > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">
                    OTA Commission ({booking.source.replace(/_/g, " ")})
                  </span>
                  <span className="text-red-400 font-medium">- {formatCurrency(commission)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-gray-800">
                <span className="text-gray-400 text-sm">Net Amount</span>
                <span className="text-white font-semibold">{formatCurrency(net)}</span>
              </div>
              {vatRate > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">
                    VAT ({(vatRate * 100).toFixed(0)}%{booking.isVatInclusive ? " inclusive" : ""})
                  </span>
                  <span className="text-yellow-400 text-sm">{formatCurrency(vatAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-gray-800">
                <span className="text-white font-semibold">Total</span>
                <span className="text-emerald-400 font-bold text-lg">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Related Transactions */}
          {transactions.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Transactions ({transactions.length})
              </h2>
              <div className="space-y-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {transactions.map((tx: any) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm truncate">{tx.description}</p>
                      <p className="text-gray-500 text-xs">
                        {formatDate(tx.date)} · {tx.category.replace(/_/g, " ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-4 shrink-0">
                      <StatusBadge status={tx.status.toLowerCase()} />
                      <span
                        className={`font-medium text-sm ${
                          tx.type === "INCOME" ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {tx.type === "INCOME" ? "+" : "-"}
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column — sidebar */}
        <div className="space-y-6">
          {/* Invoice Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Invoice
            </h2>
            {invoice ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Number</span>
                  <span className="text-white font-mono text-sm">{invoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Status</span>
                  <StatusBadge status={invoice.status.toLowerCase()} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Amount</span>
                  <span className="text-white font-semibold">
                    {formatCurrency(invoice.totalAmount)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Due Date</span>
                  <span className="text-white text-sm">{formatDate(invoice.dueDate)}</span>
                </div>
                <Link
                  href={`/invoices/${invoice.id}`}
                  className="block w-full text-center py-2 rounded-xl text-sm font-medium bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors mt-2"
                >
                  View Invoice →
                </Link>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">
                No invoice yet. Use &quot;Create Invoice&quot; to generate one.
              </p>
            )}
          </div>

          {/* Actions Card */}
          {(booking.status === "CONFIRMED" || booking.status === "CHECKED_IN") && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Actions
              </h2>
              <BookingActions bookingId={booking.id} currentStatus={booking.status} />
            </div>
          )}

          {/* Room Rate Info */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Room Rate
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">Rate / night</span>
                <span className="text-white text-sm">{formatCurrency(booking.roomRate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">Nights</span>
                <span className="text-white text-sm">{nights}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
