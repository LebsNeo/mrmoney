"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  confirmBooking,
  checkInBooking,
  checkOutBooking,
  cancelBooking,
  markNoShow,
} from "@/lib/actions/booking-status";

interface BookingActionsProps {
  bookingId: string;
  currentStatus: string;
}

export function BookingActions({ bookingId, currentStatus }: BookingActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);

  async function handleAction(
    action: () => Promise<{ success: boolean; message: string }>,
    key: string
  ) {
    setLoading(key);
    setError(null);
    try {
      const result = await action();
      if (!result.success) {
        setError(result.message);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(null);
    }
  }

  async function handleCancel() {
    if (!cancelReason.trim()) {
      setError("Please provide a cancellation reason");
      return;
    }
    await handleAction(() => cancelBooking(bookingId, cancelReason), "cancel");
    setShowCancelModal(false);
  }

  const btnBase =
    "px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {/* Confirm → DRAFT invoice */}
        {currentStatus === "CONFIRMED" && (
          <button
            disabled={!!loading}
            onClick={() => handleAction(() => confirmBooking(bookingId), "confirm")}
            className={`${btnBase} bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20`}
          >
            {loading === "confirm" ? "Processing..." : "Create Invoice"}
          </button>
        )}

        {/* Check In */}
        {currentStatus === "CONFIRMED" && (
          <button
            disabled={!!loading}
            onClick={() => handleAction(() => checkInBooking(bookingId), "checkin")}
            className={`${btnBase} bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20`}
          >
            {loading === "checkin" ? "Processing..." : "Check In"}
          </button>
        )}

        {/* Check Out */}
        {currentStatus === "CHECKED_IN" && (
          <button
            disabled={!!loading}
            onClick={() => handleAction(() => checkOutBooking(bookingId), "checkout")}
            className={`${btnBase} bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20`}
          >
            {loading === "checkout" ? "Processing..." : "Check Out"}
          </button>
        )}

        {/* Cancel */}
        {(currentStatus === "CONFIRMED" || currentStatus === "CHECKED_IN") && (
          <button
            disabled={!!loading}
            onClick={() => setShowCancelModal(true)}
            className={`${btnBase} bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20`}
          >
            Cancel Booking
          </button>
        )}

        {/* No Show */}
        {currentStatus === "CONFIRMED" && (
          <button
            disabled={!!loading}
            onClick={() => handleAction(() => markNoShow(bookingId), "noshow")}
            className={`${btnBase} bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20`}
          >
            {loading === "noshow" ? "Processing..." : "Mark No-Show"}
          </button>
        )}
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-white">Cancel Booking</h3>
            <p className="text-sm text-gray-400">
              This will void all related transactions and cancel the invoice. This action cannot be undone.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 transition-colors"
              >
                Keep Booking
              </button>
              <button
                disabled={!!loading}
                onClick={handleCancel}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
              >
                {loading === "cancel" ? "Cancelling..." : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
