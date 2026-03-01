"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import type { ChannelStat, RoomOccupancyStat, MonthlySnapshot } from "@/lib/actions/intelligence";

interface Property { id: string; name: string }

const SOURCE_LABELS: Record<string, string> = {
  DIRECT: "Direct",
  WALKIN: "Walk-in",
  BOOKING_COM: "Booking.com",
  AIRBNB: "Airbnb",
  LEKKERSLAAP: "Lekkerslaap",
  EXPEDIA: "Expedia",
  WHATSAPP: "WhatsApp",
  OTHER: "Other",
};

const SOURCE_COLORS: Record<string, string> = {
  DIRECT: "bg-emerald-500",
  WALKIN: "bg-teal-500",
  BOOKING_COM: "bg-blue-500",
  AIRBNB: "bg-rose-500",
  LEKKERSLAAP: "bg-amber-500",
  EXPEDIA: "bg-violet-500",
  WHATSAPP: "bg-green-500",
  OTHER: "bg-gray-500",
};

const SOURCE_BADGE: Record<string, string> = {
  DIRECT: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  WALKIN: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  BOOKING_COM: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  AIRBNB: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  LEKKERSLAAP: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  EXPEDIA: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  WHATSAPP: "bg-green-500/10 text-green-400 border-green-500/20",
  OTHER: "bg-gray-700/50 text-gray-400 border-gray-600",
};

type SummaryData = {
  totalRooms: number;
  daysElapsed: number;
  daysInMonth: number;
  thisMonth: { bookings: number; roomNights: number; revenue: number; commission: number; occupancy: number; adr: number; revpar: number };
  lastMonth: { bookings: number; roomNights: number; revenue: number; commission: number; occupancy: number; adr: number; revpar: number };
  mom: { revenue: number; occupancy: number; adr: number; revpar: number; commission: number };
  pace: number;
};

type RoomData = {
  rooms: RoomOccupancyStat[];
  period: { start: string; end: string; days: number };
};

type ChannelData = {
  channels: ChannelStat[];
  totalNet: number;
  totalBookings: number;
  totalCommission: number;
  period: { start: string; end: string };
};

interface Props {
  properties: Property[];
  selectedPropertyId: string;
  channelData: ChannelData | null;
  roomData: RoomData | null;
  trendData: MonthlySnapshot[];
  summaryData: SummaryData | null;
}

const fmt = (n: number) =>
  `R${n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtDec = (n: number) =>
  `R${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const momBadge = (v: number) => {
  if (Math.abs(v) < 0.5) return <span className="text-gray-500 text-xs">—</span>;
  return (
    <span className={`text-xs font-medium ${v > 0 ? "text-emerald-400" : "text-red-400"}`}>
      {v > 0 ? "▲" : "▼"} {Math.abs(v).toFixed(1)}%
    </span>
  );
};

export function IntelligenceClient({ properties, selectedPropertyId, channelData, roomData, trendData, summaryData }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function switchProperty(id: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("propertyId", id);
    router.push(`/intelligence?${p.toString()}`);
  }

  const maxRevpar = Math.max(...(trendData.map(t => t.revpar)), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <PageHeader
          title="Intelligence"
          description="Booking-driven analytics — channel mix, occupancy, revenue trends"
        />
        {properties.length > 1 && (
          <select
            value={selectedPropertyId}
            onChange={e => switchProperty(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {/* ── MOM SUMMARY STRIP ─────────────────────────────────────────────── */}
      {summaryData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-5 gap-3 mb-6">
          {[
            { label: "Revenue MTD", value: fmt(summaryData.thisMonth.revenue), mom: summaryData.mom.revenue, sub: `Pace: ${fmt(summaryData.pace)}` },
            { label: "Occupancy", value: pct(summaryData.thisMonth.occupancy), mom: summaryData.mom.occupancy, sub: `${summaryData.thisMonth.roomNights} room nights` },
            { label: "ADR", value: fmtDec(summaryData.thisMonth.adr), mom: summaryData.mom.adr, sub: "Avg daily rate" },
            { label: "RevPAR", value: fmtDec(summaryData.thisMonth.revpar), mom: summaryData.mom.revpar, sub: `${summaryData.totalRooms} rooms` },
            { label: "Commission Cost", value: fmt(summaryData.thisMonth.commission), mom: summaryData.mom.commission * -1, sub: `${summaryData.thisMonth.commission > 0 && summaryData.thisMonth.revenue > 0 ? ((summaryData.thisMonth.commission / (summaryData.thisMonth.revenue + summaryData.thisMonth.commission)) * 100).toFixed(1) : 0}% of gross`, invert: true },
          ].map(card => (
            <div key={card.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1">{card.label}</p>
              <p className="text-xl font-bold text-white mb-1">{card.value}</p>
              <div className="flex items-center gap-2">
                {momBadge(card.mom)}
                <span className="text-[10px] text-gray-600 truncate">{card.sub}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">

        {/* ── CHANNEL MIX ───────────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">Channel Mix</h2>
            <p className="text-xs text-gray-500 mt-0.5">Revenue by booking source — this month</p>
          </div>

          {!channelData || channelData.channels.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500 text-sm">No booking data yet.</p>
              <p className="text-gray-600 text-xs mt-1">Create bookings or import OTA statements to see channel breakdown.</p>
            </div>
          ) : (
            <div className="p-6">
              {/* Revenue share bar */}
              <div className="flex h-3 rounded-full overflow-hidden mb-4 gap-0.5">
                {channelData.channels.map(c => (
                  <div
                    key={c.source}
                    className={`${SOURCE_COLORS[c.source] ?? "bg-gray-500"} transition-all`}
                    style={{ width: `${(c.revenueShare * 100).toFixed(1)}%` }}
                    title={`${SOURCE_LABELS[c.source] ?? c.source}: ${(c.revenueShare * 100).toFixed(1)}%`}
                  />
                ))}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 mb-5">
                {channelData.channels.map(c => (
                  <div key={c.source} className="flex items-center gap-1.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${SOURCE_COLORS[c.source] ?? "bg-gray-500"}`} />
                    <span className="text-xs text-gray-400">{SOURCE_LABELS[c.source] ?? c.source}</span>
                    <span className="text-xs text-gray-600">{(c.revenueShare * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>

              {/* Channel table */}
              <div className="space-y-3">
                {channelData.channels.map(c => (
                  <div key={c.source} className="bg-gray-800/50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md border font-medium ${SOURCE_BADGE[c.source] ?? "bg-gray-700 text-gray-400 border-gray-600"}`}>
                          {SOURCE_LABELS[c.source] ?? c.source}
                        </span>
                        <span className="text-xs text-gray-500">{c.bookings} booking{c.bookings !== 1 ? "s" : ""} · {c.roomNights}n</span>
                      </div>
                      <span className="text-sm font-semibold text-white">{fmt(c.netRevenue)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-gray-600">ADR</p>
                        <p className="text-gray-300 font-medium">{fmtDec(c.avgRate)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Avg stay</p>
                        <p className="text-gray-300 font-medium">{c.avgNights.toFixed(1)}n</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Commission</p>
                        <p className={`font-medium ${c.totalCommission > 0 ? "text-red-400" : "text-gray-300"}`}>
                          {c.totalCommission > 0 ? `−${fmt(c.totalCommission)} (${(c.commissionRate * 100).toFixed(1)}%)` : "None"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {channelData.totalCommission > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-800 flex justify-between text-xs">
                  <span className="text-gray-500">Total commission cost this month</span>
                  <span className="text-red-400 font-semibold">−{fmt(channelData.totalCommission)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── ROOM OCCUPANCY ────────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">Room Performance</h2>
            <p className="text-xs text-gray-500 mt-0.5">Occupancy + RevPAR by room — this month</p>
          </div>

          {!roomData || roomData.rooms.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500 text-sm">No rooms or bookings found for this property.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {roomData.rooms.map(room => (
                <div key={room.roomId} className="px-6 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-white">{room.roomName}</p>
                      <p className="text-xs text-gray-500">{room.roomType.replace(/_/g, " ")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">{fmt(room.revenue)}</p>
                      <p className="text-xs text-gray-500">RevPAR {fmtDec(room.revpar)}</p>
                    </div>
                  </div>
                  {/* Occupancy bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          room.occupancyRate >= 0.8 ? "bg-emerald-500"
                            : room.occupancyRate >= 0.5 ? "bg-blue-500"
                            : room.occupancyRate >= 0.2 ? "bg-amber-500"
                            : "bg-gray-600"
                        }`}
                        style={{ width: `${Math.min(100, room.occupancyRate * 100).toFixed(1)}%` }}
                      />
                    </div>
                    <span className={`text-xs font-semibold w-12 text-right ${
                      room.occupancyRate >= 0.8 ? "text-emerald-400"
                        : room.occupancyRate >= 0.5 ? "text-blue-400"
                        : room.occupancyRate >= 0.2 ? "text-amber-400"
                        : "text-gray-500"
                    }`}>
                      {pct(room.occupancyRate)}
                    </span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-gray-600">{room.occupiedNights} / {room.nights} nights</span>
                    <span className="text-[10px] text-gray-600">ADR {fmtDec(room.adr)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 6-MONTH REVENUE TREND ──────────────────────────────────────────── */}
      {trendData.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl mb-6">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">6-Month Trend</h2>
            <p className="text-xs text-gray-500 mt-0.5">Revenue, occupancy, ADR, RevPAR</p>
          </div>

          {/* Revenue bar chart */}
          <div className="p-6">
            <p className="text-xs text-gray-500 mb-4 uppercase tracking-wider font-medium">Net Revenue</p>
            <div className="flex items-end gap-3 h-28 mb-2">
              {trendData.map((t, i) => {
                const maxRev = Math.max(...trendData.map(x => x.revenue), 1);
                const h = maxRev > 0 ? (t.revenue / maxRev) * 100 : 0;
                const isLast = i === trendData.length - 1;
                return (
                  <div key={t.isoMonth} className="flex-1 flex flex-col items-center gap-1">
                    <span className={`text-[10px] font-semibold ${isLast ? "text-emerald-400" : "text-gray-500"}`}>
                      {fmt(t.revenue)}
                    </span>
                    <div className="w-full flex items-end" style={{ height: "64px" }}>
                      <div
                        className={`w-full rounded-t-lg transition-all ${isLast ? "bg-emerald-500" : "bg-gray-700"}`}
                        style={{ height: `${h.toFixed(1)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-600">{t.month}</span>
                  </div>
                );
              })}
            </div>

            {/* RevPAR sparkline */}
            <div className="mt-6 pt-4 border-t border-gray-800">
              <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider font-medium">RevPAR Trend</p>
              <div className="flex items-end gap-3 h-16">
                {trendData.map((t, i) => {
                  const h = maxRevpar > 0 ? (t.revpar / maxRevpar) * 100 : 0;
                  const isLast = i === trendData.length - 1;
                  return (
                    <div key={t.isoMonth} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end" style={{ height: "40px" }}>
                        <div
                          className={`w-full rounded-t transition-all ${isLast ? "bg-blue-500" : "bg-gray-700/70"}`}
                          style={{ height: `${h.toFixed(1)}%` }}
                        />
                      </div>
                      <span className={`text-[10px] ${isLast ? "text-blue-400 font-semibold" : "text-gray-600"}`}>
                        {fmtDec(t.revpar)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Table summary */}
            <div className="mt-6 pt-4 border-t border-gray-800 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500">
                    <th className="text-left pb-2 font-medium">Month</th>
                    <th className="text-right pb-2 font-medium">Bookings</th>
                    <th className="text-right pb-2 font-medium">Occupancy</th>
                    <th className="text-right pb-2 font-medium">ADR</th>
                    <th className="text-right pb-2 font-medium">RevPAR</th>
                    <th className="text-right pb-2 font-medium">Net P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {trendData.map((t, i) => {
                    const isLast = i === trendData.length - 1;
                    return (
                      <tr key={t.isoMonth} className={isLast ? "text-white" : "text-gray-400"}>
                        <td className="py-2 font-medium">{t.month}</td>
                        <td className="py-2 text-right">{t.bookings}</td>
                        <td className="py-2 text-right">{pct(t.occupancyRate)}</td>
                        <td className="py-2 text-right">{fmtDec(t.adr)}</td>
                        <td className="py-2 text-right">{fmtDec(t.revpar)}</td>
                        <td className={`py-2 text-right font-semibold ${t.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {t.netProfit >= 0 ? "+" : ""}{fmt(t.netProfit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── EMPTY STATE ────────────────────────────────────────────────────── */}
      {!channelData && !roomData && trendData.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
          <p className="text-3xl mb-3">📊</p>
          <p className="text-white font-medium mb-2">No data yet</p>
          <p className="text-gray-500 text-sm">Create bookings or import OTA statements to unlock intelligence.</p>
        </div>
      )}
    </div>
  );
}
