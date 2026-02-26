"use client";

import { useMemo } from "react";
import { parseISO, getDay, format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { formatCurrency, formatPercent } from "@/lib/utils";

interface DayData {
  date: string; // YYYY-MM-DD
  occupancyRate: number;
  revenue: number;
}

interface OccupancyCalendarProps {
  data: DayData[];
}

function getOccupancyColor(rate: number): string {
  if (rate === 0) return "bg-gray-800 text-gray-600";
  if (rate < 0.3) return "bg-gray-700 text-gray-400";
  if (rate < 0.6) return "bg-yellow-900/60 text-yellow-300";
  if (rate < 0.8) return "bg-orange-900/60 text-orange-300";
  return "bg-emerald-900/60 text-emerald-300";
}

function getIndicatorColor(rate: number): string {
  if (rate === 0) return "bg-gray-700";
  if (rate < 0.3) return "bg-gray-500";
  if (rate < 0.6) return "bg-yellow-500";
  if (rate < 0.8) return "bg-orange-500";
  return "bg-emerald-500";
}

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function OccupancyCalendar({ data }: OccupancyCalendarProps) {
  const { cells, month } = useMemo(() => {
    if (data.length === 0) return { cells: [], month: "" };

    const firstDate = parseISO(data[0].date);
    const month = format(firstDate, "MMMM yyyy");

    // Build a map of date string -> data
    const dataMap = new Map(data.map((d) => [d.date, d]));

    // Calendar starts on Monday (index 1 in JS, 0=Sun)
    // getDay returns 0=Sun, 1=Mon, ..., 6=Sat
    // We want Mon=0, Tue=1, ..., Sun=6
    const firstDayJS = getDay(firstDate); // 0=Sun, 1=Mon, ..., 6=Sat
    const firstDayMon = firstDayJS === 0 ? 6 : firstDayJS - 1; // Convert to Mon-based

    const allDays = eachDayOfInterval({
      start: startOfMonth(firstDate),
      end: endOfMonth(firstDate),
    });

    // Build the grid cells: null = empty placeholder
    const cells: Array<{ date: string; occupancyRate: number; revenue: number } | null> = [];

    // Leading empty cells
    for (let i = 0; i < firstDayMon; i++) {
      cells.push(null);
    }

    for (const day of allDays) {
      const dateStr = format(day, "yyyy-MM-dd");
      const dayData = dataMap.get(dateStr);
      cells.push({
        date: dateStr,
        occupancyRate: dayData?.occupancyRate ?? 0,
        revenue: dayData?.revenue ?? 0,
      });
    }

    // Trailing empty cells to complete the last row
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return { cells, month };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No occupancy data for this month.
      </div>
    );
  }

  return (
    <div>
      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs text-gray-400 flex-wrap">
        <span className="font-medium text-gray-300">{month}</span>
        <div className="flex items-center gap-1.5 ml-auto flex-wrap gap-y-1">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-gray-500 inline-block" /> &lt;30%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-yellow-500 inline-block" /> 30–60%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-orange-500 inline-block" /> 60–80%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> &gt;80%
          </span>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="text-center text-xs text-gray-500 font-medium py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} className="aspect-square" />;
          }
          const dayNum = parseInt(cell.date.split("-")[2], 10);
          const colorClass = getOccupancyColor(cell.occupancyRate);
          const dotClass = getIndicatorColor(cell.occupancyRate);

          return (
            <div
              key={cell.date}
              className={`rounded-lg p-1 sm:p-1.5 flex flex-col items-center gap-0.5 ${colorClass} min-h-[52px] sm:min-h-[64px] relative group cursor-default`}
              title={`${cell.date} — ${formatPercent(cell.occupancyRate)} occupancy · ${formatCurrency(cell.revenue)}`}
            >
              <span className="text-xs font-semibold leading-none">{dayNum}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${dotClass} shrink-0`} />
              <span className="text-[10px] leading-none hidden sm:block opacity-80">
                {Math.round(cell.occupancyRate * 100)}%
              </span>

              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                <div className="bg-gray-800 border border-gray-700 text-gray-200 text-[10px] rounded-lg px-2.5 py-2 whitespace-nowrap shadow-xl">
                  <div className="font-semibold">{cell.date}</div>
                  <div>Occupancy: {formatPercent(cell.occupancyRate)}</div>
                  <div>Revenue: {formatCurrency(cell.revenue)}</div>
                </div>
                <div className="w-2 h-2 bg-gray-800 border-r border-b border-gray-700 rotate-45 -mt-1" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
