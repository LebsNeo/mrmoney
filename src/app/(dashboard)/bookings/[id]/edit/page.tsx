"use client";

import { useState, useEffect, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/context/ToastContext";
import { updateBookingDetails } from "@/lib/actions/bookings";
import Link from "next/link";

interface Booking {
  id: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  checkIn: string;
  checkOut: string;
  status: string;
  notes: string | null;
  roomId: string | null;
  room: { id: string; name: string } | null;
  property: { id: string; name: string; };
}

interface Room { id: string; name: string; }

export default function EditBookingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [roomId, setRoomId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [bRes, rRes] = await Promise.all([
          fetch(`/api/calendar?year=${new Date().getFullYear()}&month=${new Date().getMonth() + 1}`),
          fetch("/api/user/properties?withRooms=true"),
        ]);
        // Load booking directly
        const bData = await fetch(`/api/bookings/${id}`).then(r => r.json()).catch(() => null);
        const rData = await rRes.json();

        if (bData?.data) {
          const b = bData.data;
          setBooking(b);
          setGuestName(b.guestName);
          setGuestEmail(b.guestEmail ?? "");
          setGuestPhone(b.guestPhone ?? "");
          setCheckIn(b.checkIn?.split("T")[0] ?? "");
          setCheckOut(b.checkOut?.split("T")[0] ?? "");
          setRoomId(b.roomId ?? b.room?.id ?? "");
          setNotes(b.notes ?? "");

          // Find rooms for this property
          const props = rData.data ?? rData;
          if (Array.isArray(props)) {
            const prop = props.find((p: { id: string }) => p.id === b.property?.id);
            setRooms(prop?.rooms ?? []);
          }
        }
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  function handleSave() {
    if (!guestName.trim()) { showToast("Guest name is required", "error"); return; }
    if (!checkIn || !checkOut) { showToast("Dates are required", "error"); return; }

    startTransition(async () => {
      const result = await updateBookingDetails(id, {
        guestName,
        guestEmail: guestEmail || null,
        guestPhone: guestPhone || null,
        checkIn,
        checkOut,
        roomId: roomId || undefined,
        notes: notes || null,
      });
      if (result.success) {
        showToast("Reservation updated", "success");
        router.push(`/bookings/${id}`);
      } else {
        showToast(result.message ?? "Failed to update", "error");
      }
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!booking) {
    return <div className="text-center py-20 text-gray-500">Booking not found</div>;
  }

  const inputClass = "w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent";
  const labelClass = "block text-xs font-medium text-gray-400 mb-1.5";

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
        <Link href="/bookings" className="hover:text-white transition-colors">Bookings</Link>
        <span>/</span>
        <Link href={`/bookings/${id}`} className="hover:text-white transition-colors">{booking.guestName}</Link>
        <span>/</span>
        <span className="text-white">Edit</span>
      </div>

      <PageHeader
        title="Edit Reservation"
        description={`${booking.property.name} · ${booking.room?.name ?? "Room"}`}
      />

      <div className="space-y-6">
        {/* Guest Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Guest Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="sm:col-span-2">
              <label className={labelClass}>Guest Name *</label>
              <input value={guestName} onChange={e => setGuestName(e.target.value)} className={inputClass} placeholder="Guest name" />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} className={inputClass} placeholder="guest@email.com" />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input value={guestPhone} onChange={e => setGuestPhone(e.target.value)} className={inputClass} placeholder="+27..." />
            </div>
          </div>
        </div>

        {/* Dates & Room */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Stay Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className={labelClass}>Check-in *</label>
              <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Check-out *</label>
              <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Room</label>
              <select value={roomId} onChange={e => setRoomId(e.target.value)} className={inputClass}>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Notes</h2>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={inputClass} placeholder="Internal notes..." />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href={`/bookings/${id}`} className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 transition-colors">
            Cancel
          </Link>
          <button onClick={handleSave} disabled={isPending}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors disabled:opacity-50">
            {isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
