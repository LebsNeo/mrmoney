"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/context/ToastContext";
import { updateWorkerWhatsApp } from "@/lib/actions/workers";
import { sendTestPayslip } from "@/app/actions/payroll-whatsapp";

type Worker = {
  id: string;
  name: string;
  propertyName: string;
  whatsappNumber: string | null;
  whatsappOptIn: boolean;
  tipsThisMonth: number;
  activeSavingsGoals: number;
};

export function WorkersClient({ workers: initialWorkers }: { workers: Worker[] }) {
  const [workers, setWorkers] = useState(initialWorkers);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  function updateLocalWorker(workerId: string, patch: Partial<Worker>) {
    setWorkers((current) => current.map((worker) => (worker.id === workerId ? { ...worker, ...patch } : worker)));
  }

  function saveWorker(worker: Worker) {
    setPendingId(worker.id);
    startTransition(async () => {
      const result = await updateWorkerWhatsApp({
        employeeId: worker.id,
        whatsappNumber: worker.whatsappNumber ?? "",
        whatsappOptIn: worker.whatsappOptIn,
      });
      setPendingId(null);
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      showToast(`Saved WhatsApp settings for ${worker.name}.`, "success");
    });
  }

  function triggerTestPayslip(worker: Worker) {
    setPendingId(worker.id);
    startTransition(async () => {
      const result = await sendTestPayslip(worker.id);
      setPendingId(null);
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      if (result.sent > 0) {
        showToast(`Test payslip sent to ${worker.name}.`, "success");
        return;
      }
      showToast(`No message sent for ${worker.name}.`, "warning");
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-500">
          {workers.length} workers tracked
        </p>
        <Link
          href="/workers/stokvels"
          className="px-4 py-2 rounded-xl bg-gray-900 border border-gray-800 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
        >
          Open Stokvels
        </Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {workers.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No workers found.</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {workers.map((worker) => {
              const rowPending = isPending && pendingId === worker.id;
              return (
                <div key={worker.id} className="p-5 grid gap-4 lg:grid-cols-[1.2fr_1.3fr_.7fr_.7fr_auto] items-center">
                  <div>
                    <p className="text-white font-semibold">{worker.name}</p>
                    <p className="text-xs text-gray-500">{worker.propertyName}</p>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5">WhatsApp Number</label>
                    <input
                      value={worker.whatsappNumber ?? ""}
                      onChange={(event) => updateLocalWorker(worker.id, { whatsappNumber: event.target.value })}
                      placeholder="+27 82 000 0000"
                      className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5">Opt In</label>
                    <button
                      type="button"
                      onClick={() => updateLocalWorker(worker.id, { whatsappOptIn: !worker.whatsappOptIn })}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                        worker.whatsappOptIn
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-gray-800 text-gray-400"
                      }`}
                    >
                      {worker.whatsappOptIn ? "Enabled" : "Disabled"}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                    <div>
                      <p className="text-xs text-gray-500">Tips This Month</p>
                      <p className="text-sm font-semibold text-emerald-400">{formatCurrency(worker.tipsThisMonth)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Savings Goals</p>
                      <p className="text-sm text-white">{worker.activeSavingsGoals}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-start lg:justify-end flex-wrap">
                    <button
                      type="button"
                      onClick={() => saveWorker(worker)}
                      disabled={rowPending}
                      className="px-3 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-400 disabled:opacity-50 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerTestPayslip(worker)}
                      disabled={rowPending}
                      className="px-3 py-2 rounded-xl bg-gray-800 text-gray-300 text-sm font-medium hover:bg-gray-700 hover:text-white disabled:opacity-50 transition-colors"
                    >
                      Send Test Payslip
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
