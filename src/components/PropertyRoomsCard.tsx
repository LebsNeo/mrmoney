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
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
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
      setFormError("Name and a valid base rate are required.");
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
    <div className="border-t border-gray-800 mt-4 pt-4">
      {/* Toggle rooms section */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-3"
      >
        <span className={`transition-transform ${expanded ? "rotate-90" : ""}`}>▶</span>
        <span>
          {rooms.length} room{rooms.length !== 1 ? "s" : ""} · {activeRooms.length} active
        </span>
      </button>

      {expanded && (
        <div className="space-y-2">
          {rooms.length === 0 && !showForm && (
            <p className="text-sm text-gray-500 italic">No rooms yet. Add one below.</p>
          )}

          {rooms.map((room) => (
            <div
              key={room.id}
              className="flex items-center justify-between bg-gray-800/50 rounded-xl px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm text-white font-medium">{room.name}</p>
                  <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded">
                    {roomTypeLabels[room.type]}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      room.status === RoomStatus.ACTIVE
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-gray-700 text-gray-500"
                    }`}
                  >
                    {room.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatCurrency(getRate(room.baseRate))}/night · max {room.maxOccupancy} guests
                  {room.description ? ` · ${room.description}` : ""}
                </p>
              </div>
              <button
                onClick={() => handleToggle(room.id)}
                disabled={isPending}
                className="text-xs px-3 py-1 rounded-lg bg-gray-700 text-gray-300 hover:text-white hover:bg-gray-600 transition-colors disabled:opacity-50 ml-3 shrink-0"
              >
                {room.status === RoomStatus.ACTIVE ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))}

          {/* Add Room Form */}
          {showForm ? (
            <form onSubmit={handleAddRoom} className="bg-gray-800/70 rounded-xl p-4 space-y-3 mt-2">
              <p className="text-sm font-medium text-white mb-2">New Room</p>
              {formError && (
                <p className="text-xs text-red-400 bg-red-500/10 rounded px-3 py-2">{formError}</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Room name *</label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g. Room 101"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Type</label>
                  <select
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {roomTypes.map((t) => (
                      <option key={t} value={t}>{roomTypeLabels[t]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Base rate / night (ZAR) *</label>
                  <input
                    name="baseRate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.baseRate}
                    onChange={handleChange}
                    placeholder="850"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Max occupancy</label>
                  <input
                    name="maxOccupancy"
                    type="number"
                    min="1"
                    max="20"
                    value={form.maxOccupancy}
                    onChange={handleChange}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Description (optional)</label>
                <input
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Garden view, en-suite…"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  {isPending ? "Saving…" : "Add Room"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setFormError(null); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-700 text-gray-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
            >
              + Add Room
            </button>
          )}
        </div>
      )}
    </div>
  );
}
