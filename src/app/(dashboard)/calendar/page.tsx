"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Booking {
  id: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  checkIn: string;
  checkOut: string;
  source: string;
  status: string;
  grossAmount: string;
  netAmount: string;
  externalRef: string | null;
  notes: string | null;
  room: { id: string; name: string };
  property: { id: string; name: string };
}

interface Room { id: string; name: string; propertyId: string; property: { name: string } }
interface Property { id: string; name: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const OTA_COLORS: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  BOOKING_COM: { bg: "bg-blue-500/20", text: "text-blue-300", dot: "bg-blue-400",  label: "Booking.com" },
  AIRBNB:      { bg: "bg-rose-500/20", text: "text-rose-300",  dot: "bg-rose-400",  label: "Airbnb" },
  LEKKERSLAAP: { bg: "bg-emerald-500/20", text: "text-emerald-300", dot: "bg-emerald-400", label: "Lekkerslaap" },
  DIRECT:      { bg: "bg-purple-500/20", text: "text-purple-300", dot: "bg-purple-400", label: "Direct" },
  EXPEDIA:     { bg: "bg-yellow-500/20", text: "text-yellow-300", dot: "bg-yellow-400", label: "Expedia" },
};

const DEFAULT_COLOR = { bg: "bg-gray-500/20", text: "text-gray-300", dot: "bg-gray-400", label: "Other" };

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function otaColor(source: string) { return OTA_COLORS[source] ?? DEFAULT_COLOR; }

function formatMoney(val: string) {
  return "R " + parseFloat(val).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function calcNights(checkIn: string, checkOut: string) {
  return Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState<string>("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [view, setView] = useState<"month" | "grid">("month");

  // Load properties once
  useEffect(() => {
    fetch("/api/user/properties")
      .then(r => r.json())
      .then(d => {
        const props = d.data ?? d;
        setProperties(Array.isArray(props) ? props : []);
      });
  }, []);

  // Load calendar data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ year: String(year), month: String(month) });
      if (propertyId) qs.set("propertyId", propertyId);
      const res = await fetch(`/api/calendar?${qs}`);
      const d = await res.json();
      setBookings(d.data?.bookings ?? []);
      setRooms(d.data?.rooms ?? []);
    } finally {
      setLoading(false);
    }
  }, [year, month, propertyId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Calendar math ──────────────────────────────────────────────────────────

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;

  // Map date string "YYYY-MM-DD" → bookings that cover it
  function bookingsOnDay(day: number): Booking[] {
    const date = new Date(year, month - 1, day);
    return bookings.filter(b => {
      const ci = new Date(b.checkIn);
      const co = new Date(b.checkOut);
      return ci <= date && co > date;
    });
  }

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  // ─── Grid view helpers (rooms × days) ───────────────────────────────────────

  function bookingForRoomOnDay(roomId: string, day: number): Booking | null {
    const date = new Date(year, month - 1, day);
    return bookings.find(b => {
      if (b.room.id !== roomId) return false;
      const ci = new Date(b.checkIn);
      const co = new Date(b.checkOut);
      return ci <= date && co > date;
    }) ?? null;
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Live booking calendar across all properties and OTAs"
        action={
          <div className="flex gap-2 items-center">
            {/* View toggle */}
            <div className="flex bg-gray-800 rounded-xl p-1 gap-1">
              <button onClick={() => setView("month")} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", view === "month" ? "bg-emerald-500 text-white" : "text-gray-400 hover:text-white")}>Month</button>
              <button onClick={() => setView("grid")} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", view === "grid" ? "bg-emerald-500 text-white" : "text-gray-400 hover:text-white")}>Room Grid</button>
            </div>
            {/* Property filter */}
            <select
              value={propertyId}
              onChange={e => setPropertyId(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All properties</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        }
      />

      {/* Month navigator */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={prevMonth} className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/></svg>
        </button>
        <div className="text-center">
          <h2 className="text-xl font-bold text-white">{MONTHS[month - 1]} {year}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{bookings.length} booking{bookings.length !== 1 ? "s" : ""} this month</p>
        </div>
        <button onClick={nextMonth} className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
        </button>
      </div>

      {/* OTA legend */}
      <div className="flex flex-wrap gap-3 mb-5">
        {Object.entries(OTA_COLORS).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5 text-xs text-gray-400">
            <div className={cn("w-2.5 h-2.5 rounded-full", v.dot)} />
            {v.label}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500 text-sm">Loading calendar...</div>
      ) : view === "month" ? (
        // ── MONTH VIEW ─────────────────────────────────────────────────────────
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-800">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-500 py-3">{d}</div>
            ))}
          </div>
          {/* Cells */}
          <div className="grid grid-cols-7">
            {Array.from({ length: totalCells }).map((_, i) => {
              const dayNum = i - firstDayOfWeek + 1;
              const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
              const isToday = isCurrentMonth && dayNum === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
              const dayBookings = isCurrentMonth ? bookingsOnDay(dayNum) : [];

              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-[80px] p-1.5 border-b border-r border-gray-800 relative",
                    !isCurrentMonth && "bg-gray-900/40",
                    isCurrentMonth && "hover:bg-gray-800/40 transition-colors cursor-default"
                  )}
                >
                  {isCurrentMonth && (
                    <>
                      <span className={cn(
                        "inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full mb-1",
                        isToday ? "bg-emerald-500 text-white" : "text-gray-400"
                      )}>
                        {dayNum}
                      </span>
                      <div className="space-y-0.5">
                        {dayBookings.slice(0, 3).map(b => {
                          const c = otaColor(b.source);
                          return (
                            <button
                              key={b.id}
                              onClick={() => setSelected(b)}
                              className={cn(
                                "w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium leading-tight truncate transition-opacity hover:opacity-80",
                                c.bg, c.text
                              )}
                              title={`${b.guestName} · ${b.room.name}`}
                            >
                              <span className="hidden sm:inline">{b.room.name} · </span>
                              {b.guestName.split(" ")[0]}
                            </button>
                          );
                        })}
                        {dayBookings.length > 3 && (
                          <div className="text-[10px] text-gray-500 px-1">+{dayBookings.length - 3} more</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        // ── ROOM GRID VIEW ─────────────────────────────────────────────────────
        <div className="overflow-x-auto rounded-2xl border border-gray-800">
          <table className="border-collapse" style={{ minWidth: `${64 + daysInMonth * 36}px` }}>
            <thead>
              <tr className="bg-gray-900 border-b border-gray-800">
                <th className="sticky left-0 z-10 bg-gray-900 text-left text-xs text-gray-500 font-medium px-3 py-3 w-32 border-r border-gray-800">Room</th>
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const d = i + 1;
                  const isToday = d === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
                  return (
                    <th key={d} className={cn("text-center text-xs font-medium py-2 w-9", isToday ? "text-emerald-400" : "text-gray-500")}>
                      {d}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rooms.map(room => (
                <tr key={room.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                  <td className="sticky left-0 z-10 bg-gray-900 text-xs text-gray-300 font-medium px-3 py-2 border-r border-gray-800 whitespace-nowrap">
                    <div>{room.name}</div>
                    <div className="text-gray-600 text-[10px]">{room.property.name}</div>
                  </td>
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const d = i + 1;
                    const booking = bookingForRoomOnDay(room.id, d);
                    const c = booking ? otaColor(booking.source) : null;
                    const isToday = d === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
                    const isCheckIn = booking && new Date(booking.checkIn).getDate() === d && new Date(booking.checkIn).getMonth() + 1 === month;
                    return (
                      <td
                        key={d}
                        className={cn(
                          "w-9 h-8 text-center relative border-r border-gray-800/50 transition-all",
                          isToday && "bg-emerald-500/5",
                          booking && c && cn(c.bg, "cursor-pointer hover:opacity-80"),
                        )}
                        onClick={() => booking && setSelected(booking)}
                        title={booking ? `${booking.guestName} · ${otaColor(booking.source).label}` : undefined}
                      >
                        {booking && isCheckIn && (
                          <div className={cn("w-2 h-2 rounded-full mx-auto mt-3", c?.dot)} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Booking detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60" onClick={() => setSelected(null)}>
          <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className={cn("px-5 py-4 flex items-center justify-between", otaColor(selected.source).bg)}>
              <div>
                <div className="flex items-center gap-2">
                  <div className={cn("w-2.5 h-2.5 rounded-full", otaColor(selected.source).dot)} />
                  <span className={cn("text-xs font-semibold", otaColor(selected.source).text)}>{otaColor(selected.source).label}</span>
                </div>
                <h3 className="text-white font-bold text-lg mt-1">{selected.guestName}</h3>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-white transition-colors p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            {/* Details */}
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Check-in</p>
                  <p className="text-white font-semibold mt-0.5">{new Date(selected.checkIn).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Check-out</p>
                  <p className="text-white font-semibold mt-0.5">{new Date(selected.checkOut).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Nights</p>
                  <p className="text-white font-semibold mt-0.5">{calcNights(selected.checkIn, selected.checkOut)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Room</p>
                  <p className="text-white font-semibold mt-0.5">{selected.room.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Property</p>
                  <p className="text-white font-semibold mt-0.5">{selected.property.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400">
                    {selected.status}
                  </span>
                </div>
              </div>
              <div className="border-t border-gray-800 pt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Gross amount</p>
                  <p className="text-white font-bold text-lg mt-0.5">{formatMoney(selected.grossAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Net (after OTA)</p>
                  <p className="text-emerald-400 font-bold text-lg mt-0.5">{formatMoney(selected.netAmount)}</p>
                </div>
              </div>
              {(selected.guestEmail || selected.guestPhone) && (
                <div className="border-t border-gray-800 pt-4 space-y-2">
                  {selected.guestEmail && (
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>
                      {selected.guestEmail}
                    </div>
                  )}
                  {selected.guestPhone && (
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/></svg>
                      {selected.guestPhone}
                    </div>
                  )}
                </div>
              )}
              {selected.notes && (
                <div className="border-t border-gray-800 pt-4">
                  <p className="text-xs text-gray-500">Notes</p>
                  <p className="text-gray-300 text-sm mt-1">{selected.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
