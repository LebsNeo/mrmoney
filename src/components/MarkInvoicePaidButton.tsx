"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PaymentMethod } from "@prisma/client";
import { markInvoicePaid } from "@/lib/actions/invoices";
import { useToast } from "@/context/ToastContext";

interface MarkInvoicePaidButtonProps {
  invoiceId: string;
  invoiceNumber: string;
}

export function MarkInvoicePaidButton({ invoiceId, invoiceNumber }: MarkInvoicePaidButtonProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.EFT);
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePaid() {
    if (!reference.trim()) {
      showToast("Payment reference is required", "warning");
      setError("Payment reference is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await markInvoicePaid(invoiceId, paymentMethod, reference.trim());
      if (!result.success) {
        showToast(result.message, "error");
        setError(result.message);
      } else {
        showToast(`Invoice ${invoiceNumber} marked as paid ✓`, "success");
        setOpen(false);
        router.refresh();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to mark as paid";
      showToast(msg, "error");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
      >
        Mark Paid
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-white">Mark Invoice Paid</h3>
            <p className="text-sm text-gray-400">
              Invoice: <span className="text-white font-mono">{invoiceNumber}</span>
            </p>
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                {Object.values(PaymentMethod).map((m) => (
                  <option key={m} value={m}>
                    {m.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Payment Reference *
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. EFT-2024-001 or cash received"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
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
                onClick={handlePaid}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50"
              >
                {loading ? "Processing..." : "Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
