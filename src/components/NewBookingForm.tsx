"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createBooking } from "@/lib/actions/bookings";
import { BookingSource } from "@prisma/client";
import { useToast } from "@/context/ToastContext";

interface Room {
  id: string;
  name: string;
  type: string;
  baseRate: { toString(): string };
}

interface AvailabilityRoom {
  id: string;
  name: string;
  type: string;
  baseRate: number;
  available: boolean;
  conflictBooking: { guestName: string; checkIn: string; checkOut: string } | null;
}

interface Property {
  id: string;
  name: string;
  rooms: Room[];
}

interface NewBookingFormProps {
  properties: Property[];
}

const OTA_COMMISSION: Record<string, number> = {
  AIRBNB: 0.0345,
  BOOKING_COM: 0.15,
  EXPEDIA: 0.15,
  LEKKERSLAAP: 0.10,
  DIRECT: 0,
  WALKIN: 0,
  OTHER: 0,
};

const ORG_VAT_RATE = 0.15; // ZA default

export function NewBookingForm({ properties }: NewBookingFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [roomId, setRoomId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [source, setSource] = useState<BookingSource>(BookingSource.DIRECT);
  const [commissionPct, setCommissionPct] = useState(0);
  const [isVatInclusive, setIsVatInclusive] = useState(false);
  const [vatEnabled, setVatEnabled] = useState(false);
  const [customRoomRate, setCustomRoomRate] = useState<number | null>(null);

  // Payment at booking creation
  const [collectPayment, setCollectPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "EFT" | "CARD">("CASH");
  const [paymentAmount, setPaymentAmount] = useState<number | null>(null);

  // Room availability
  const [availabilityMap, setAvailabilityMap] = useState<Map<string, AvailabilityRoom>>(new Map());
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Derived rooms for selected property
  const selectedProperty = properties.find((p) => p.id === propertyId);
  const rooms = selectedProperty?.rooms ?? [];

  // When property changes, reset room
  useEffect(() => {
    setRoomId(rooms[0]?.id ?? "");
  }, [propertyId]);

  // When source changes, update commission
  useEffect(() => {
    setCommissionPct(OTA_COMMISSION[source] ?? 0);
  }, [source]);

  // When room changes, set rate
  useEffect(() => {
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      setCustomRoomRate(parseFloat(room.baseRate.toString()));
    }
  }, [roomId]);

  // Fetch room availability when dates + property change
  const fetchAvailability = useCallback(async () => {
    if (!propertyId || !checkIn || !checkOut) {
      setAvailabilityMap(new Map());
      return;
    }
    setCheckingAvailability(true);
    try {
      const qs = new URLSearchParams({ propertyId, checkIn, checkOut });
      const res = await fetch(`/api/rooms/availability?${qs}`);
      const json = await res.json();
      const data: AvailabilityRoom[] = json.data ?? [];
      setAvailabilityMap(new Map(data.map(r => [r.id, r])));
      // Auto-select first available room if current room is unavailable
      const current = data.find(r => r.id === roomId);
      if (current && !current.available) {
        const first = data.find(r => r.available);
        if (first) setRoomId(first.id);
      }
    } catch {
      // silently fail — availability check is advisory
    } finally {
      setCheckingAvailability(false);
    }
  }, [propertyId, checkIn, checkOut]);

  useEffect(() => { fetchAvailability(); }, [fetchAvailability]);

  // Derived financial values
  const roomRate = customRoomRate ?? 0;
  const nights =
    checkIn && checkOut
      ? Math.max(
          0,
          Math.round(
            (new Date(checkOut).getTime() - new Date(checkIn).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : 0;
  const grossAmount = roomRate * nights;
  const otaCommission = grossAmount * commissionPct;
  const netAmount = grossAmount - otaCommission;
  const vatRate = vatEnabled ? ORG_VAT_RATE : 0;
  const vatAmount = vatEnabled
    ? isVatInclusive
      ? grossAmount - grossAmount / (1 + vatRate)
      : grossAmount * vatRate
    : 0;
  const total = vatEnabled && !isVatInclusive ? grossAmount + vatAmount : grossAmount;

  function fmt(n: number) {
    return n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!propertyId || !roomId || !guestName || !checkIn || !checkOut) {
      setError("Please fill in all required fields");
      return;
    }
    if (nights <= 0) {
      setError("Check-out must be after check-in");
      return;
    }

    setLoading(true);
    try {
      const result = await createBooking({
        propertyId,
        roomId,
        guestName,
        guestEmail,
        guestPhone,
        checkIn,
        checkOut,
        source,
        otaCommissionPct: commissionPct,
        roomRate,
        grossAmount,
        isVatInclusive,
        vatRate,
        collectPayment,
        paymentMethod: paymentMethod as "CASH" | "EFT" | "CARD",
        paymentAmount: paymentAmount ?? undefined,
      });

      if (!result.success) {
        const msg = result.message ?? "Failed to create booking";
        showToast(msg, "error");
        setError(msg);
      } else {
        showToast("Booking created successfully!", "success");
        router.push(`/bookings/${result.bookingId}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      showToast(msg, "error");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors";
  const labelClass = "block text-xs font-medium text-gray-400 mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Property & Room */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Property & Room
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Property *</label>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className={inputClass}
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>
              Room *
              {checkingAvailability && (
                <span className="ml-2 text-[10px] text-gray-500 font-normal">Checking availability...</span>
              )}
            </label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className={inputClass}
            >
              {rooms.map((r) => {
                const avail = availabilityMap.get(r.id);
                const isUnavailable = avail && !avail.available;
                return (
                  <option key={r.id} value={r.id} disabled={!!isUnavailable}>
                    {isUnavailable
                      ? `🚫 ${r.name} — Occupied (${avail!.conflictBooking?.guestName})`
                      : avail
                      ? `✓ ${r.name} (${r.type})`
                      : `${r.name} (${r.type})`}
                  </option>
                );
              })}
            </select>
            {/* Conflict warning for selected room */}
            {(() => {
              const avail = availabilityMap.get(roomId);
              if (avail && !avail.available && avail.conflictBooking) {
                const ci = new Date(avail.conflictBooking.checkIn).toLocaleDateString("en-ZA");
                const co = new Date(avail.conflictBooking.checkOut).toLocaleDateString("en-ZA");
                return (
                  <p className="text-xs text-red-400 mt-1.5">
                    ⚠ Room occupied by <strong>{avail.conflictBooking.guestName}</strong> ({ci} → {co})
                  </p>
                );
              }
              if (avail?.available && checkIn && checkOut) {
                return <p className="text-xs text-emerald-400 mt-1.5">✓ Available for selected dates</p>;
              }
              return null;
            })()}
          </div>
        </div>
        <div>
          <label className={labelClass}>Room Rate / Night (ZAR) *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={customRoomRate ?? ""}
            onChange={(e) => setCustomRoomRate(parseFloat(e.target.value) || 0)}
            placeholder="e.g. 1500.00"
            className={inputClass}
          />
        </div>
      </div>

      {/* Guest Info */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Guest Information
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelClass}>Guest Name *</label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="e.g. John Smith"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="guest@example.com"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="+27 82 000 0000"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Dates & Source */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Stay & Source
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Check-in *</label>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Check-out *</label>
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              min={checkIn}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Source *</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as BookingSource)}
              className={inputClass}
            >
              {Object.values(BookingSource).map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>OTA Commission %</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={(commissionPct * 100).toFixed(1)}
              onChange={(e) => setCommissionPct(parseFloat(e.target.value) / 100 || 0)}
              className={inputClass}
            />
            <p className="text-xs text-gray-500 mt-1">
              Auto-set by source. Override if needed.
            </p>
          </div>

          <div>
            <label className={labelClass}>VAT</label>
            <div className="flex items-center gap-3 mt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={vatEnabled}
                  onChange={(e) => setVatEnabled(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-gray-300">Apply VAT (15%)</span>
              </label>
              {vatEnabled && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isVatInclusive}
                    onChange={(e) => setIsVatInclusive(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-gray-300">VAT inclusive</span>
                </label>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Live Preview */}
      {nights > 0 && roomRate > 0 && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-4">
            Live Preview — {nights} night{nights !== 1 ? "s" : ""}
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Gross Amount</span>
              <span className="text-white">R {fmt(grossAmount)}</span>
            </div>
            {otaCommission > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">OTA Commission ({(commissionPct * 100).toFixed(0)}%)</span>
                <span className="text-red-400">- R {fmt(otaCommission)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-700 pt-2">
              <span className="text-gray-400">Net Amount</span>
              <span className="text-white font-medium">R {fmt(netAmount)}</span>
            </div>
            {vatEnabled && (
              <div className="flex justify-between">
                <span className="text-gray-400">
                  VAT (15%{isVatInclusive ? " incl." : ""})
                </span>
                <span className="text-yellow-400">R {fmt(vatAmount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-700 pt-2">
              <span className="text-white font-semibold">Total</span>
              <span className="text-emerald-400 font-bold text-base">R {fmt(total)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Collect Payment Now */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Collect Payment Now
            </h2>
            <p className="text-xs text-gray-500 mt-1">Walk-in cash · EFT on arrival · Card</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={collectPayment}
              onChange={(e) => {
                setCollectPayment(e.target.checked);
                if (e.target.checked && netAmount > 0) setPaymentAmount(netAmount);
              }}
              className="w-4 h-4 rounded accent-emerald-500"
            />
            <span className="text-sm text-gray-300">Payment received</span>
          </label>
        </div>

        {collectPayment && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Payment Method</label>
              <div className="flex gap-2">
                {(["CASH", "EFT", "CARD"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      paymentMethod === m
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
                    }`}
                  >
                    {m === "CASH" ? "💵 Cash" : m === "EFT" ? "🏦 EFT" : "💳 Card"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>Amount Received (ZAR)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={paymentAmount ?? ""}
                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                placeholder={`e.g. ${fmt(netAmount)}`}
                className={inputClass}
              />
              {paymentAmount !== null && paymentAmount < netAmount && (
                <p className="text-xs text-amber-400 mt-1">
                  ⚠ Partial payment — balance R {fmt(netAmount - paymentAmount)} outstanding
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <a
          href="/bookings"
          className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 transition-colors"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 rounded-xl text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Creating..." : "Create Booking"}
        </button>
      </div>
    </form>
  );
}
