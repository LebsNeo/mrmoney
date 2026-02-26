import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import type { RoomProfitability } from "@/lib/profitability";

interface Props {
  room: RoomProfitability;
  trend?: "up" | "down" | "neutral";
}

export function RoomProfitCard({ room, trend = "neutral" }: Props) {
  const marginColor =
    room.profitMargin >= 0.6
      ? "text-emerald-400"
      : room.profitMargin >= 0.3
      ? "text-amber-400"
      : "text-red-400";

  const marginBg =
    room.profitMargin >= 0.6
      ? "bg-emerald-500/10"
      : room.profitMargin >= 0.3
      ? "bg-amber-500/10"
      : "bg-red-500/10";

  const trendIcon =
    trend === "up" ? "↑" : trend === "down" ? "↓" : "—";
  const trendColor =
    trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-gray-500";

  const roomTypeLabel = room.roomType.charAt(0) + room.roomType.slice(1).toLowerCase();

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">{room.roomName}</p>
          <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-md text-xs font-medium bg-gray-800 text-gray-400">
            {roomTypeLabel}
          </span>
        </div>
        <span className={cn("text-lg font-bold", trendColor)}>{trendIcon}</span>
      </div>

      {/* Occupancy — big number */}
      <div className="text-center py-2">
        <p className="text-3xl font-bold text-white">{formatPercent(room.occupancyRate, 0)}</p>
        <p className="text-xs text-gray-500 mt-0.5">Occupancy</p>
        <p className="text-xs text-gray-600 mt-0.5">{room.occupiedNights} / {room.availableNights} nights</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="text-xs text-gray-500">Revenue</p>
          <p className="text-sm font-semibold text-white">{formatCurrency(room.revenue)}</p>
        </div>
        <div className="text-center border-x border-gray-800">
          <p className="text-xs text-gray-500">Costs</p>
          <p className="text-sm font-semibold text-red-400">{formatCurrency(room.totalCosts)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500">Net</p>
          <p className={cn("text-sm font-semibold", room.netProfit >= 0 ? "text-emerald-400" : "text-red-400")}>
            {formatCurrency(room.netProfit)}
          </p>
        </div>
      </div>

      {/* Margin badge */}
      <div className={cn("rounded-xl px-3 py-2 text-center", marginBg)}>
        <p className={cn("text-lg font-bold", marginColor)}>
          {formatPercent(room.profitMargin, 1)}
        </p>
        <p className="text-xs text-gray-500">Profit Margin</p>
      </div>
    </div>
  );
}
