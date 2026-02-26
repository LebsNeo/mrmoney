import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";

interface BookingCardProps {
  id: string;
  guestName: string;
  guestEmail?: string | null;
  checkIn: Date | string;
  checkOut: Date | string;
  nights: number;
  source: string;
  status: string;
  netAmount: number | { toString(): string };
  roomName: string;
}

export function BookingCard({
  id,
  guestName,
  checkIn,
  checkOut,
  nights,
  source,
  status,
  netAmount,
  roomName,
}: BookingCardProps) {
  return (
    <Link
      href={`/bookings/${id}`}
      className="block bg-gray-900 border border-gray-800 rounded-2xl p-4 hover:border-gray-700 transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-white font-semibold text-sm">{guestName}</p>
          <p className="text-gray-500 text-xs mt-0.5">{roomName}</p>
        </div>
        <p className="text-white font-bold text-sm">{formatCurrency(netAmount)}</p>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
        <span>{formatDate(checkIn, "dd MMM")}</span>
        <span>→</span>
        <span>{formatDate(checkOut, "dd MMM")}</span>
        <span className="text-gray-600">·</span>
        <span>{nights}n</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
          {source.replace(/_/g, " ")}
        </span>
        <StatusBadge status={status.toLowerCase()} />
      </div>
    </Link>
  );
}
