"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

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
  room: { id: string; name: string } | null;
  bookingRooms?: { roomId: string; room: { id: string; name: string } }[];
  property: { id: string; name: string };
}

interface Room { id: string; name: string; propertyId: string; property: { name: string } }
interface Property { id: string; name: string }

const OTA: Record<string, { bg: string; border: string; text: string; dot: string; glow: string; label: string; icon: string }> = {
  BOOKING_COM: { bg: "bg-blue-500/20",    border: "border-blue-500/30",    text: "text-blue-200",    dot: "bg-blue-400",    glow: "shadow-blue-500/20",   label: "Booking.com", icon: "🔵" },
  AIRBNB:      { bg: "bg-rose-500/20",    border: "border-rose-500/30",    text: "text-rose-200",    dot: "bg-rose-400",    glow: "shadow-rose-500/20",   label: "Airbnb",      icon: "🔴" },
  LEKKERSLAAP: { bg: "bg-emerald-500/20", border: "border-emerald-500/30", text: "text-emerald-200", dot: "bg-emerald-400", glow: "shadow-emerald-500/20",label: "Lekkerslaap", icon: "🟢" },
  DIRECT:      { bg: "bg-violet-500/20",  border: "border-violet-500/30",  text: "text-violet-200",  dot: "bg-violet-400",  glow: "shadow-violet-500/20", label: "Direct",      icon: "🟣" },
  EXPEDIA:     { bg: "bg-amber-500/20",   border: "border-amber-500/30",   text: "text-amber-200",   dot: "bg-amber-400",   glow: "shadow-amber-500/20",  label: "Expedia",     icon: "🟡" },
};
const DEFAULT_OTA = { bg: "bg-gray-500/20", border: "border-gray-500/30", text: "text-gray-300", dot: "bg-gray-400", glow: "", label: "Other", icon: "⚪" };
const ota = (s: string) => OTA[s] ?? DEFAULT_OTA;

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const fmt = (d: string) => new Date(d).toLocaleDateString("en-ZA", { day:"numeric", month:"short", year:"numeric" });
const nights = (ci: string, co: string) => Math.round((new Date(co).getTime() - new Date(ci).getTime()) / 86400000);
const money = (v: string) => "R " + parseFloat(v).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [bookings, setBookings]   = useState<Booking[]>([]);
  const [rooms, setRooms]         = useState<Room[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<Booking | null>(null);
  const [view, setView]           = useState<"month"|"week"|"day"|"grid">("month");
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    fetch("/api/user/properties").then(r=>r.json()).then(d=>{
      const p = d.data ?? d;
      setProperties(Array.isArray(p) ? p : []);
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // For week/day views, also fetch adjacent month if week spans month boundary
      const fetchMonth = async (y: number, m: number) => {
        const qs = new URLSearchParams({ year: String(y), month: String(m) });
        if (propertyId) qs.set("propertyId", propertyId);
        return fetch(`/api/calendar?${qs}`).then(r => r.json());
      };
      const d = await fetchMonth(year, month);
      let allBookings: Booking[] = d.data?.bookings ?? [];
      // If week/day view crosses into next month, fetch next month too
      if (view === "week" || view === "day") {
        const weekDays = getWeekDays(currentDate);
        const lastDay = weekDays[weekDays.length - 1];
        if (lastDay.getMonth() + 1 !== month || lastDay.getFullYear() !== year) {
          const d2 = await fetchMonth(lastDay.getFullYear(), lastDay.getMonth() + 1);
          const extra: Booking[] = d2.data?.bookings ?? [];
          const ids = new Set(allBookings.map((b: Booking) => b.id));
          allBookings = [...allBookings, ...extra.filter((b: Booking) => !ids.has(b.id))];
        }
      }
      setBookings(allBookings);
      setRooms(d.data?.rooms ?? []);
    } finally { setLoading(false); }
  }, [year, month, propertyId, view, currentDate]);

  useEffect(() => { load(); }, [load]);

  // ── Week/Day helpers ──────────────────────────────────────────
  function getWeekDays(date: Date): Date[] {
    const day = date.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setDate(date.getDate() + mondayOffset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }

  function bookingsOnDate(date: Date): Booking[] {
    const d = new Date(date); d.setHours(12, 0, 0, 0);
    return bookings.filter(b => new Date(b.checkIn) <= d && new Date(b.checkOut) > d);
  }

  function bookingForRoomDate(roomId: string, date: Date): Booking | null {
    const d = new Date(date); d.setHours(12, 0, 0, 0);
    return bookings.find(b => {
      if (!(new Date(b.checkIn) <= d && new Date(b.checkOut) > d)) return false;
      if (b.room?.id === roomId) return true;
      return b.bookingRooms?.some((br: { roomId: string }) => br.roomId === roomId) ?? false;
    }) ?? null;
  }

  function isDateToday(d: Date) {
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  }

  const weekDays = getWeekDays(currentDate);

  // ── Month-view helpers ────────────────────────────────────────
  const daysInMonth   = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const totalCells    = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;

  const bookingsOnDay = (day: number) => {
    // Use Date.UTC — checkIn/checkOut are @db.Date stored as UTC midnight.
    // new Date(year, month-1, day) = LOCAL midnight which on UTC+2 is 2h before UTC midnight,
    // causing bookings to vanish because checkIn (UTC midnight) > local midnight.
    const d = new Date(Date.UTC(year, month - 1, day));
    return bookings.filter(b => new Date(b.checkIn) <= d && new Date(b.checkOut) > d);
  };

  const bookingForRoomDay = (roomId: string, day: number) => {
    const d = new Date(Date.UTC(year, month - 1, day));
    return bookings.find(b => {
      const inRange = new Date(b.checkIn) <= d && new Date(b.checkOut) > d;
      if (!inRange) return false;
      // Match primary room OR any room in a multi-room booking
      if (b.room?.id === roomId) return true;
      return b.bookingRooms?.some((br: { roomId: string }) => br.roomId === roomId) ?? false;
    }) ?? null;
  };

  const isCheckInDay = (b: Booking, day: number) =>
    new Date(b.checkIn).getDate() === day && new Date(b.checkIn).getMonth() + 1 === month;
  const isCheckOutDay = (b: Booking, day: number) =>
    new Date(b.checkOut).getDate() === day && new Date(b.checkOut).getMonth() + 1 === month;

  const prev = () => {
    if (view === "day") {
      const d = new Date(currentDate); d.setDate(d.getDate() - 1);
      setCurrentDate(d); setYear(d.getFullYear()); setMonth(d.getMonth() + 1);
    } else if (view === "week") {
      const d = new Date(currentDate); d.setDate(d.getDate() - 7);
      setCurrentDate(d); setYear(d.getFullYear()); setMonth(d.getMonth() + 1);
    } else {
      month === 1 ? (setYear(y=>y-1), setMonth(12)) : setMonth(m=>m-1);
    }
  };
  const next = () => {
    if (view === "day") {
      const d = new Date(currentDate); d.setDate(d.getDate() + 1);
      setCurrentDate(d); setYear(d.getFullYear()); setMonth(d.getMonth() + 1);
    } else if (view === "week") {
      const d = new Date(currentDate); d.setDate(d.getDate() + 7);
      setCurrentDate(d); setYear(d.getFullYear()); setMonth(d.getMonth() + 1);
    } else {
      month === 12 ? (setYear(y=>y+1), setMonth(1)) : setMonth(m=>m+1);
    }
  };

  const occupiedDays = new Set(
    bookings.flatMap(b => {
      const days = [];
      const ci = new Date(b.checkIn), co = new Date(b.checkOut);
      for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1))
        if (d.getMonth() + 1 === month && d.getFullYear() === year)
          days.push(d.getDate());
      return days;
    })
  );
  const occupancyRate = daysInMonth > 0 ? Math.round((occupiedDays.size / (daysInMonth * Math.max(rooms.length, 1))) * 100) : 0;

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Calendar</h1>
          <p className="text-gray-500 text-sm mt-1">Live bookings across all properties & OTAs</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="glass flex rounded-xl p-1 gap-1">
            {([
              { v: "month", label: "📅 Month" },
              { v: "week",  label: "🗓 Week"  },
              { v: "day",   label: "☀️ Day"   },
              { v: "grid",  label: "🏨 Rooms" },
            ] as const).map(({ v, label }) => (
              <button key={v} onClick={() => {
                setView(v);
                if (v === "day" || v === "week") {
                  setCurrentDate(new Date());
                  setYear(new Date().getFullYear());
                  setMonth(new Date().getMonth() + 1);
                }
              }}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  view === v ? "bg-emerald-500/20 text-emerald-400 shadow-sm" : "text-gray-500 hover:text-gray-300"
                )}>
                {label}
              </button>
            ))}
          </div>
          {/* Property filter */}
          <select value={propertyId} onChange={e=>setPropertyId(e.target.value)}
            className="glass text-sm text-white rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 border-0">
            <option value="">All properties</option>
            {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {/* ── Month nav + stats strip ─────────────────────────────── */}
      <div className="glass rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Prev / Month / Next */}
        <div className="flex items-center gap-4">
          <button onClick={prev}
            className="w-9 h-9 rounded-xl glass flex items-center justify-center text-gray-400 hover:text-white hover:border-white/10 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/></svg>
          </button>
          <div className="text-center min-w-[180px]">
            {view === "day" && (
              <p className="text-lg font-bold text-white">
                {currentDate.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
            {view === "week" && (
              <p className="text-lg font-bold text-white">
                {weekDays[0].toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} – {weekDays[6].toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            )}
            {(view === "month" || view === "grid") && (
              <p className="text-lg font-bold text-white">{MONTHS[month-1]} {year}</p>
            )}
            <p className="text-xs text-gray-500">{bookings.length} booking{bookings.length!==1?"s":""}</p>
          </div>
          <button onClick={next}
            className="w-9 h-9 rounded-xl glass flex items-center justify-center text-gray-400 hover:text-white hover:border-white/10 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
          </button>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-4 flex-wrap justify-center">
          <div className="text-center px-4 border-r border-white/5">
            <p className="text-xs text-gray-500 mb-0.5">Occupancy</p>
            <p className="text-lg font-bold gradient-text">{occupancyRate}%</p>
          </div>
          <div className="text-center px-4 border-r border-white/5">
            <p className="text-xs text-gray-500 mb-0.5">Rooms</p>
            <p className="text-lg font-bold text-white">{rooms.length}</p>
          </div>
          <div className="flex items-center gap-3 px-2">
            {Object.entries(OTA).map(([k,v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <div className={cn("w-2 h-2 rounded-full", v.dot)} />
                <span className="text-[10px] text-gray-500 hidden sm:block">{v.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="glass rounded-2xl p-16 text-center">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading calendar...</p>
        </div>
      ) : view === "day" ? (

        /* ── DAY VIEW ──────────────────────────────────────────── */
        (() => {
          const dayBookings = bookingsOnDate(currentDate);
          const arriving   = dayBookings.filter(b => {
            const ci = new Date(b.checkIn); return ci.getDate() === currentDate.getDate() && ci.getMonth() === currentDate.getMonth() && ci.getFullYear() === currentDate.getFullYear();
          });
          const departing  = dayBookings.filter(b => {
            const co = new Date(b.checkOut); return co.getDate() === currentDate.getDate() && co.getMonth() === currentDate.getMonth() && co.getFullYear() === currentDate.getFullYear();
          });
          const staying    = dayBookings.filter(b => !arriving.includes(b) && !departing.includes(b));

          const BookingCard = ({ b, badge }: { b: Booking; badge: string }) => {
            const c = ota(b.source);
            const roomLabel = b.bookingRooms && b.bookingRooms.length > 1
              ? `${b.bookingRooms.length} rooms: ${b.bookingRooms.map((br: { room: { name: string } }) => br.room.name).join(", ")}`
              : b.room?.name ?? "Room";
            return (
              <button onClick={() => setSelected(b)} className={cn("w-full text-left glass rounded-xl p-4 border transition-all hover:scale-[1.01]", c.border)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{b.guestName}</span>
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", c.bg, c.border, c.text)}>{badge}</span>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full border", c.bg, c.border, c.text)}>{c.label}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{roomLabel}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{fmt(b.checkIn)} → {fmt(b.checkOut)} · {nights(b.checkIn, b.checkOut)} nights</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-white">{money(b.grossAmount)}</p>
                    <p className="text-[10px] text-gray-500">gross</p>
                  </div>
                </div>
              </button>
            );
          };

          if (dayBookings.length === 0) return (
            <div className="glass rounded-2xl p-16 text-center">
              <p className="text-4xl mb-3">🌙</p>
              <p className="text-white font-semibold mb-1">No activity today</p>
              <p className="text-gray-500 text-sm">No check-ins, check-outs or stays on this day.</p>
            </div>
          );

          return (
            <div className="space-y-4">
              {arriving.length > 0 && (
                <div className="glass rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                    <span className="text-emerald-400 text-sm">🛎</span>
                    <span className="text-sm font-semibold text-white">Arriving ({arriving.length})</span>
                  </div>
                  <div className="p-4 space-y-3">
                    {arriving.map(b => <BookingCard key={b.id} b={b} badge="CHECK IN" />)}
                  </div>
                </div>
              )}
              {staying.length > 0 && (
                <div className="glass rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                    <span className="text-blue-400 text-sm">🏨</span>
                    <span className="text-sm font-semibold text-white">Staying ({staying.length})</span>
                  </div>
                  <div className="p-4 space-y-3">
                    {staying.map(b => <BookingCard key={b.id} b={b} badge="STAYING" />)}
                  </div>
                </div>
              )}
              {departing.length > 0 && (
                <div className="glass rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                    <span className="text-amber-400 text-sm">🚪</span>
                    <span className="text-sm font-semibold text-white">Departing ({departing.length})</span>
                  </div>
                  <div className="p-4 space-y-3">
                    {departing.map(b => <BookingCard key={b.id} b={b} badge="CHECK OUT" />)}
                  </div>
                </div>
              )}
            </div>
          );
        })()

      ) : view === "week" ? (

        /* ── WEEK VIEW ─────────────────────────────────────────── */
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="border-collapse w-full" style={{ minWidth: "600px" }}>
              <thead>
                <tr className="border-b border-white/5">
                  <th className="sticky left-0 z-10 bg-gray-950/90 backdrop-blur-xl text-left text-[10px] font-semibold text-gray-600 uppercase tracking-widest px-4 py-3 w-36 border-r border-white/5">
                    Room
                  </th>
                  {weekDays.map((d, i) => {
                    const isToday = isDateToday(d);
                    const isSel = d.getDate() === currentDate.getDate() && d.getMonth() === currentDate.getMonth();
                    return (
                      <th key={i} className={cn("text-center py-3 px-2 cursor-pointer transition-colors hover:bg-white/5", isToday && "bg-emerald-500/10")}
                        onClick={() => { setCurrentDate(new Date(d)); setView("day"); }}>
                        <p className={cn("text-[10px] font-semibold uppercase tracking-wider", isToday ? "text-emerald-400" : "text-gray-500")}>
                          {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]}
                        </p>
                        <p className={cn("text-sm font-bold mt-0.5", isToday ? "text-emerald-400" : isSel ? "text-white" : "text-gray-400")}>
                          {d.getDate()}
                        </p>
                        <p className="text-[9px] text-gray-600">{d.toLocaleDateString("en-ZA", { month: "short" })}</p>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rooms.map(room => (
                  <tr key={room.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="sticky left-0 z-10 bg-gray-950/90 backdrop-blur-xl px-4 py-2.5 border-r border-white/5">
                      <p className="text-xs font-semibold text-gray-300 whitespace-nowrap">{room.name}</p>
                      <p className="text-[10px] text-gray-600">{room.property.name}</p>
                    </td>
                    {weekDays.map((d, i) => {
                      const booking = bookingForRoomDate(room.id, d);
                      const c = booking ? ota(booking.source) : null;
                      const isToday = isDateToday(d);
                      const isCI = booking && new Date(booking.checkIn).toDateString() === d.toDateString();
                      const isCO = booking && new Date(booking.checkOut).toDateString() === d.toDateString();
                      return (
                        <td key={i} className={cn(
                          "h-14 border-r border-white/[0.03] transition-all relative text-center px-1",
                          isToday && "bg-emerald-500/[0.04]",
                          booking && c && cn(c.bg, "cursor-pointer hover:brightness-125"),
                          isCI && "rounded-l-xl",
                          isCO && "rounded-r-xl",
                        )}
                          onClick={() => booking && setSelected(booking)}
                          title={booking ? `${booking.guestName} · ${c?.label}` : undefined}
                        >
                          {booking && isCI && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-1">
                              <span className={cn("text-[9px] font-bold truncate max-w-full", c?.text)}>{booking.guestName.split(" ")[0]}</span>
                              <span className={cn("text-[8px] opacity-60", c?.text)}>→ IN</span>
                            </div>
                          )}
                          {booking && !isCI && !isCO && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className={cn("w-1.5 h-1.5 rounded-full", c?.dot)} />
                            </div>
                          )}
                          {isToday && !booking && (
                            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500/50" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {rooms.length === 0 && (
                  <tr><td colSpan={8} className="py-12 text-center text-gray-500 text-sm">No rooms configured</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Week booking summary */}
          {(() => {
            const weekBookings = Array.from(new Set(weekDays.flatMap(d => bookingsOnDate(d).map(b => b.id))))
              .map(id => bookings.find(b => b.id === id)!).filter(Boolean);
            if (weekBookings.length === 0) return null;
            return (
              <div className="border-t border-white/5 px-5 py-4">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">This week — {weekBookings.length} active booking{weekBookings.length !== 1 ? "s" : ""}</p>
                <div className="flex flex-wrap gap-2">
                  {weekBookings.map(b => {
                    const c = ota(b.source);
                    return (
                      <button key={b.id} onClick={() => setSelected(b)}
                        className={cn("text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-all hover:brightness-125", c.bg, c.border, c.text)}>
                        {b.guestName.split(" ")[0]} · {b.room?.name ?? `${b.bookingRooms?.length ?? 1} rooms`}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

      ) : view === "month" ? (

        /* ── MONTH VIEW ────────────────────────────────────────── */
        <div className="glass rounded-2xl overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-white/5">
            {DAYS_SHORT.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-gray-600 uppercase tracking-widest py-3">{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7">
            {Array.from({ length: totalCells }).map((_, i) => {
              const day = i - firstDayOfWeek + 1;
              const inMonth = day >= 1 && day <= daysInMonth;
              const isToday = inMonth && day === today.getDate() && month === today.getMonth()+1 && year === today.getFullYear();
              const dayBookings = inMonth ? bookingsOnDay(day) : [];
              const hasBookings = dayBookings.length > 0;

              return (
                <div key={i} className={cn(
                  "min-h-[90px] p-2 border-b border-r border-white/[0.04] transition-all",
                  !inMonth && "opacity-20",
                  inMonth && hasBookings && "bg-white/[0.01]",
                  inMonth && !hasBookings && "hover:bg-white/[0.02]",
                )}>
                  {inMonth && (
                    <>
                      {/* Day number — click to jump to day view */}
                      <div className="flex items-center justify-between mb-1.5">
                        <button onClick={() => {
                          const d = new Date(year, month - 1, day);
                          setCurrentDate(d); setView("day");
                        }} className={cn(
                          "inline-flex items-center justify-center w-7 h-7 text-xs font-semibold rounded-full transition-all",
                          isToday
                            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                            : "text-gray-500 hover:bg-white/10 hover:text-white"
                        )}>
                          {day}
                        </button>
                        {dayBookings.length > 0 && (
                          <span className="text-[9px] text-gray-600">{dayBookings.length}</span>
                        )}
                      </div>

                      {/* Booking pills */}
                      <div className="space-y-0.5">
                        {dayBookings.slice(0, 3).map(b => {
                          const c = ota(b.source);
                          const isCI = isCheckInDay(b, day);
                          const isCO = isCheckOutDay(b, day);
                          return (
                            <button key={b.id} onClick={() => setSelected(b)}
                              className={cn(
                                "w-full text-left px-1.5 py-1 rounded-lg text-[10px] font-medium leading-none truncate transition-all hover:opacity-90 hover:scale-[1.01] border",
                                c.bg, c.border, c.text,
                                isCI && "rounded-l-full pl-2",
                                isCO && "rounded-r-full",
                              )}
                              title={`${b.guestName} · ${b.room?.name ?? "Multi-room"} · ${c.label}`}>
                              <span className="hidden sm:inline">{b.room?.name ?? "Multi-room"} · </span>
                              {b.guestName.split(" ")[0]}
                              {isCI && <span className="ml-1 opacity-60">→</span>}
                            </button>
                          );
                        })}
                        {dayBookings.length > 3 && (
                          <p className="text-[10px] text-gray-600 pl-1.5">+{dayBookings.length - 3} more</p>
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

        /* ── ROOM GRID VIEW ────────────────────────────────────── */
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="border-collapse w-full" style={{ minWidth: `${180 + daysInMonth * 34}px` }}>
              <thead>
                <tr className="border-b border-white/5">
                  <th className="sticky left-0 z-10 bg-gray-950/90 backdrop-blur-xl text-left text-[10px] font-semibold text-gray-600 uppercase tracking-widest px-4 py-3 w-44 border-r border-white/5">
                    Room
                  </th>
                  {Array.from({ length: daysInMonth }).map((_,i) => {
                    const d = i + 1;
                    const isToday = d === today.getDate() && month === today.getMonth()+1 && year === today.getFullYear();
                    return (
                      <th key={d} className={cn(
                        "text-center text-[10px] font-semibold py-3 w-8 min-w-[32px]",
                        isToday ? "text-emerald-400" : "text-gray-600"
                      )}>
                        {d}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rooms.map((room, ri) => (
                  <tr key={room.id} className={cn(
                    "border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]",
                  )}>
                    {/* Room label */}
                    <td className="sticky left-0 z-10 bg-gray-950/90 backdrop-blur-xl px-4 py-2.5 border-r border-white/5">
                      <p className="text-xs font-semibold text-gray-300 whitespace-nowrap">{room.name}</p>
                      <p className="text-[10px] text-gray-600">{room.property.name}</p>
                    </td>

                    {/* Day cells */}
                    {Array.from({ length: daysInMonth }).map((_,i) => {
                      const day = i + 1;
                      const booking = bookingForRoomDay(room.id, day);
                      const c = booking ? ota(booking.source) : null;
                      const isToday = day === today.getDate() && month === today.getMonth()+1 && year === today.getFullYear();
                      const isCI = booking ? isCheckInDay(booking, day) : false;
                      const isCO = booking ? isCheckOutDay(booking, day) : false;

                      return (
                        <td key={day} className={cn(
                          "h-10 border-r border-white/[0.03] transition-all relative",
                          isToday && "bg-emerald-500/[0.04]",
                          booking && c && cn(c.bg, "cursor-pointer hover:brightness-125"),
                          isCI && "rounded-l-full",
                          isCO && "rounded-r-full",
                        )}
                          onClick={() => booking && setSelected(booking)}
                          title={booking ? `${booking.guestName} · ${c?.label}` : undefined}
                        >
                          {booking && isCI && (
                            <div className={cn("absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full", c?.dot)} />
                          )}
                          {isToday && !booking && (
                            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500/40" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rooms.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-4xl mb-3">🏨</p>
              <p className="text-amber-400 font-semibold mb-1">⚠ No rooms found for this property</p>
              <p className="text-gray-500 text-sm mb-4">Add rooms to your property to start using the calendar.</p>
              <a href="/properties" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors">
                Add Rooms →
              </a>
            </div>
          )}
        </div>
      )}

      {/* ── Booking detail modal ──────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
          onClick={() => setSelected(null)}>
          <div className="glass-strong w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-slide-up"
            onClick={e => e.stopPropagation()}>

            {/* Coloured header */}
            <div className={cn("px-6 py-5 relative overflow-hidden", ota(selected.source).bg, ota(selected.source).border, "border-b")}>
              {/* Glow orb */}
              <div className={cn("absolute -top-6 -right-6 w-32 h-32 rounded-full blur-2xl opacity-40", ota(selected.source).dot)} />
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", ota(selected.source).dot)} />
                    <span className={cn("text-xs font-bold uppercase tracking-widest", ota(selected.source).text)}>
                      {ota(selected.source).label}
                    </span>
                  </div>
                  <button onClick={() => setSelected(null)}
                    className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/20 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
                <h3 className="text-xl font-bold text-white">{selected.guestName}</h3>
                <p className="text-sm text-white/50 mt-0.5">
                  {selected.property.name} ·{" "}
                  {selected.bookingRooms && selected.bookingRooms.length > 1
                    ? `${selected.bookingRooms.length} rooms`
                    : selected.room?.name ?? "Room"}
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {/* Dates */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Check-in",  value: fmt(selected.checkIn) },
                  { label: "Check-out", value: fmt(selected.checkOut) },
                  { label: "Nights",    value: String(nights(selected.checkIn, selected.checkOut)) },
                ].map(s => (
                  <div key={s.label} className="glass rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{s.label}</p>
                    <p className="text-sm font-bold text-white leading-tight">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Rooms booked */}
              {(() => {
                const brs = selected.bookingRooms;
                const n = nights(selected.checkIn, selected.checkOut);
                if (brs && brs.length > 0) {
                  return (
                    <div className="glass rounded-xl overflow-hidden">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider px-4 pt-3 pb-2">
                        🏨 Rooms Booked ({brs.length})
                      </p>
                      <div className="divide-y divide-white/5">
                        {brs.map((br: { roomId: string; room: { id: string; name: string } }) => (
                          <div key={br.roomId} className="flex items-center justify-between px-4 py-2.5">
                            <span className="text-sm text-white font-medium">{br.room.name}</span>
                            <span className="text-xs text-gray-500">{n} night{n !== 1 ? "s" : ""}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                // Single room fallback
                if (selected.room) {
                  return (
                    <div className="glass rounded-xl px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">🏨 Room</p>
                        <p className="text-sm text-white font-medium">{selected.room.name}</p>
                      </div>
                      <span className="text-xs text-gray-500">{n} night{n !== 1 ? "s" : ""}</span>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Revenue */}
              <div className="grid grid-cols-2 gap-3">
                <div className="glass rounded-xl p-4">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Gross</p>
                  <p className="text-lg font-bold text-white">{money(selected.grossAmount)}</p>
                </div>
                <div className="glass rounded-xl p-4 border border-emerald-500/20">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Net (after OTA)</p>
                  <p className="text-lg font-bold gradient-text">{money(selected.netAmount)}</p>
                </div>
              </div>

              {/* Contact */}
              {(selected.guestEmail || selected.guestPhone) && (
                <div className="glass rounded-xl p-4 space-y-2">
                  {selected.guestEmail && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>
                      </div>
                      <span className="text-sm text-gray-300">{selected.guestEmail}</span>
                    </div>
                  )}
                  {selected.guestPhone && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/></svg>
                      </div>
                      <span className="text-sm text-gray-300">{selected.guestPhone}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              {selected.notes && (
                <div className="glass rounded-xl px-4 py-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-sm text-gray-300">{selected.notes}</p>
                </div>
              )}

              {/* Status badge */}
              <div className="flex justify-end">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  ✓ {selected.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
