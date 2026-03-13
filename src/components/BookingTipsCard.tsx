"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/context/ToastContext";
import { recordBookingTip } from "@/lib/actions/workers";

type Employee = {
  id: string;
  name: string;
};

type Tip = {
  id: string;
  amount: number;
  tipDate: string;
  source: string | null;
  notes: string | null;
  employee: {
    name: string;
  };
};

export function BookingTipsCard({
  bookingId,
  employees,
  tips,
}: {
  bookingId: string;
  employees: Employee[];
  tips: Tip[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    employeeId: employees[0]?.id ?? "",
    amount: "",
    source: "",
  });

  function submitTip() {
    if (!form.employeeId) {
      showToast("Choose an employee first.", "warning");
      return;
    }

    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      showToast("Enter a valid tip amount.", "warning");
      return;
    }

    startTransition(async () => {
      const result = await recordBookingTip({
        bookingId,
        employeeId: form.employeeId,
        amount,
        source: form.source,
      });

      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }

      showToast("Tip recorded.", "success");
      setForm((current) => ({ ...current, amount: "", source: "" }));
      router.refresh();
    });
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Tips</h2>
          <p className="text-xs text-gray-600 mt-0.5">Record guest tips against this booking.</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1.2fr_.8fr_1fr_auto] mb-5">
        <select
          value={form.employeeId}
          onChange={(event) => setForm((current) => ({ ...current, employeeId: event.target.value }))}
          className="rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
        >
          <option value="">Select employee</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.amount}
          onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
          placeholder="Amount"
          className="rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
        />
        <input
          value={form.source}
          onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))}
          placeholder="Source"
          className="rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
        />
        <button
          type="button"
          onClick={submitTip}
          disabled={isPending}
          className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-400 disabled:opacity-50 transition-colors"
        >
          Record Tip
        </button>
      </div>

      <div className="space-y-2">
        {tips.length === 0 ? (
          <p className="text-sm text-gray-500">No tips recorded for this booking yet.</p>
        ) : (
          tips.map((tip) => (
            <div key={tip.id} className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-950 px-3 py-2 gap-4">
              <div>
                <p className="text-sm text-white">{tip.employee.name}</p>
                <p className="text-xs text-gray-500">
                  {formatDate(tip.tipDate)}
                  {tip.source ? ` · ${tip.source}` : ""}
                </p>
              </div>
              <span className="text-sm font-semibold text-emerald-400">{formatCurrency(tip.amount)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
