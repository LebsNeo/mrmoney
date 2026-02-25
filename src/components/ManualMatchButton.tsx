"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { matchPayoutItem } from "@/lib/actions/ota-payouts";

interface ManualMatchButtonProps {
  payoutItemId: string;
  guestName: string;
  checkIn: string;
}

export function ManualMatchButton({ payoutItemId, guestName, checkIn }: ManualMatchButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMatch() {
    if (!bookingId.trim()) {
      setError("Please enter a booking ID");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await matchPayoutItem(payoutItemId, bookingId.trim());
      if (!result.success) {
        setError(result.message);
      } else {
        setOpen(false);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Match failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-colors"
      >
        Match Manually
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-white">Manual Match</h3>
            <p className="text-sm text-gray-400">
              Matching: <span className="text-white">{guestName}</span> (Check-in: {checkIn})
            </p>
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Booking ID (UUID)
              </label>
              <input
                type="text"
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                placeholder="Paste booking UUID..."
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                disabled={loading}
                onClick={handleMatch}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50"
              >
                {loading ? "Matching..." : "Confirm Match"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
