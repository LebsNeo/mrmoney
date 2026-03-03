"use client";

import { useState, useTransition } from "react";
import { RoomType, RoomStatus } from "@prisma/client";
import { addRoom, toggleRoomStatus } from "@/app/(dashboard)/properties/actions";
import { formatCurrency } from "@/lib/utils";

interface Room {
  id: string;
  name: string;
  description: string | null;
  type: RoomType;
  baseRate: number | { toNumber: () => number };
  maxOccupancy: number;
  status: RoomStatus;
}

interface PropertyRoomsCardProps {
  propertyId: string;
  rooms: Room[];
}

const roomTypeLabels: Record<RoomType, string> = {
  SINGLE: "Single",
  DOUBLE: "Double",
  TWIN: "Twin",
  QUEEN: "Queen",
  KING: "King",
  SUITE: "Suite",
  DORM: "Dorm",
};

function getRate(rate: number | { toNumber: () => number }): number {
  if (typeof rate === "number") return rate;
  return rate.toNumber();
}

const roomTypes = Object.values(RoomType);

export function PropertyRoomsCard({ propertyId, rooms }: PropertyRoomsCardProps) {
  // Default expanded — users should never miss this
  const [expanded, setExpanded] = useState(true);
  const [showForm, setShowForm] = useState(rooms.length === 0); // auto-open form if no rooms yet
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    type: RoomType.DOUBLE,
    baseRate: "",
    maxOccupancy: "2",
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleAddRoom(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const rate = parseFloat(form.baseRate);
    if (!form.name.trim() || isNaN(rate) || rate <= 0) {
      setFormError("Room name and a valid nightly rate are required.");
      return;
    }
    startTransition(async () => {
      const result = await addRoom(propertyId, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        type: form.type,
        baseRate: rate,
        maxOccupancy: parseInt(form.maxOccupancy) || 2,
      });
      if (result.success) {
        setShowForm(false);
        setForm({ name: "", description: "", type: RoomType.DOUBLE, baseRate: "", maxOccupancy: "2" });
      } else {
        setFormError(result.message ?? "Failed to add room");
      }
    });
  }

  async function handleToggle(roomId: string) {
    startTransition(async () => {
      await toggleRoomStatus(roomId);
    });
  }

  const activeRooms = rooms.filter((r) => r.status === RoomStatus.ACTIVE);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      {/* ── Section header — always visible ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-base">
            🛏
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Rooms</p>
            <p className="text-xs text-gray-500">
              {rooms.length === 0
                ? "No rooms added yet"
                : `${rooms.length} room${rooms.length !== 1 ? "s" : ""} · ${activeRooms.length} active`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Always-visible Add Room button */}
          {!showForm && (
            <button
              onClick={() => { setShowForm(true); setExpanded(true); }}
              className="btn-primary !text-xs !py-1.5 !px-3"
            >
              <span className="text-sm leading-none">+</span>
              Add Room
            </button>
          )}
          {/* Collapse toggle */}
          {rooms.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors"
              title={expanded ? "Collapse" : "Expand"}
            >
              <svg
                className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Empty state — shown when no rooms and form is closed ── */}
      {rooms.length === 0 && !showForm && (
        <div className="px-5 py-10 text-center">
          <div className="text-4xl mb-3">🛏</div>
          <p className="text-sm font-medium text-white mb-1">No rooms yet</p>
          <p className="text-xs text-gray-500 mb-4">
            Add your rooms to enable bookings and availability tracking
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary"
          >
            + Add Your First Room
          </button>
        </div>
      )}

      {/* ── Room list ── */}
      {expanded && rooms.length > 0 && (
        <div className="divide-y divide-gray-800/60">
          {rooms.map((room) => (
            <div key={room.id} className="flex items-center justify-between px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm text-white font-medium">{room.name}</p>
                  <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                    {roomTypeLabels[room.type] ?? room.type}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      room.status === RoomStatus.ACTIVE
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-gray-700/50 text-gray-500"
                    }`}
                  >
                    {room.status === RoomStatus.ACTIVE ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatCurrency(getRate(room.baseRate))}/night · {room.maxOccupancy} guests max
                  {room.description ? ` · ${room.description}` : ""}
                </p>
              </div>
              <button
                onClick={() => handleToggle(room.id)}
                disabled={isPending}
                className="ml-3 text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-50 shrink-0"
              >
                {room.status === RoomStatus.ACTIVE ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Add Room Form ── */}
      {showForm && (
        <form
          onSubmit={handleAddRoom}
          className="px-5 py-5 border-t border-gray-800 bg-gray-900/50 space-y-4"
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-white">New Room</p>
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormError(null); }}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              ✕ Cancel
            </button>
          </div>

          {formError && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              {formError}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Room name *</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Room 1, Garden Suite"
                autoFocus
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Room type</label>
              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              >
                {roomTypes.map((t) => (
                  <option key={t} value={t}>{roomTypeLabels[t] ?? t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Nightly rate (ZAR) *</label>
              <input
                name="baseRate"
                type="number"
                min="0"
                step="0.01"
                value={form.baseRate}
                onChange={handleChange}
                placeholder="550"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Max guests</label>
              <input
                name="maxOccupancy"
                type="number"
                min="1"
                max="20"
                value={form.maxOccupancy}
                onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Description <span className="text-gray-600 font-normal">(optional)</span>
            </label>
            <input
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="e.g. Garden view, en-suite bathroom"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="btn-primary flex-1 sm:flex-none"
            >
              {isPending ? "Saving…" : "Add Room"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormError(null); }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
