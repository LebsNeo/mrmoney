"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/context/ToastContext";
import { updateWorkerWhatsApp } from "@/lib/actions/workers";
import { sendTestPayslip, generateEmployeeTelegramLink, unlinkEmployeeTelegram } from "@/app/actions/payroll-whatsapp";

type Worker = {
  id: string;
  name: string;
  propertyName: string;
  whatsappNumber: string | null;
  whatsappOptIn: boolean;
  telegramChatId: string | null;
  telegramOptIn: boolean;
  tipsThisMonth: number;
  activeSavingsGoals: number;
};

export function WorkersClient({ workers: initialWorkers }: { workers: Worker[] }) {
  const [workers, setWorkers] = useState(initialWorkers);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [telegramLink, setTelegramLink] = useState<{ url: string; name: string } | null>(null);
  const { showToast } = useToast();

  function updateLocalWorker(workerId: string, patch: Partial<Worker>) {
    setWorkers((current) => current.map((w) => (w.id === workerId ? { ...w, ...patch } : w)));
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
      if (!result.ok) { showToast(result.error, "error"); return; }
      showToast(`Saved WhatsApp settings for ${worker.name}.`, "success");
    });
  }

  function triggerTestPayslip(worker: Worker) {
    setPendingId(worker.id);
    startTransition(async () => {
      const result = await sendTestPayslip(worker.id);
      setPendingId(null);
      if (!result.ok) { showToast(result.error, "error"); return; }
      if (result.sent > 0) { showToast(`Test payslip sent to ${worker.name}.`, "success"); return; }
      showToast(`No message sent for ${worker.name}. Check WhatsApp/Telegram opt-in.`, "warning");
    });
  }

  function triggerTelegramLink(worker: Worker) {
    setPendingId(worker.id);
    startTransition(async () => {
      const result = await generateEmployeeTelegramLink(worker.id);
      setPendingId(null);
      if (!result.ok) { showToast(result.error, "error"); return; }
      setTelegramLink({ url: result.url!, name: result.employeeName! });
      if (result.alreadyLinked) {
        showToast(`${worker.name} is already linked. New link generated to re-link.`, "info");
      }
    });
  }

  function triggerUnlinkTelegram(worker: Worker) {
    setPendingId(worker.id);
    startTransition(async () => {
      const result = await unlinkEmployeeTelegram(worker.id);
      setPendingId(null);
      if (!result.ok) { showToast(result.error, "error"); return; }
      updateLocalWorker(worker.id, { telegramChatId: null, telegramOptIn: false });
      showToast(`Telegram unlinked for ${worker.name}.`, "success");
    });
  }

  return (
    <div className="space-y-6">
      {/* Telegram Link Modal */}
      {telegramLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h2 className="text-white font-semibold text-lg">📱 Telegram Link for {telegramLink.name}</h2>
            <p className="text-sm text-gray-400">
              Share this link with the employee. When they tap it, Telegram opens and their account will be linked to MrCA automatically.
            </p>
            <div className="bg-gray-950 border border-gray-700 rounded-xl p-3 break-all text-xs text-emerald-400 font-mono">
              {telegramLink.url}
            </div>
            <p className="text-xs text-gray-500">⏱ Link expires in 30 minutes.</p>
            <div className="flex gap-3">
              <button
                onClick={() => { navigator.clipboard.writeText(telegramLink.url); showToast("Link copied!", "success"); }}
                className="flex-1 px-3 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-400 transition-colors"
              >
                Copy Link
              </button>
              <button
                onClick={() => setTelegramLink(null)}
                className="flex-1 px-3 py-2 rounded-xl bg-gray-800 text-gray-300 text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-500">{workers.length} workers tracked</p>
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
                <div key={worker.id} className="p-5 space-y-4">
                  {/* Name + stats row */}
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-white font-semibold">{worker.name}</p>
                      <p className="text-xs text-gray-500">{worker.propertyName}</p>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Tips This Month</p>
                        <p className="font-semibold text-emerald-400">{formatCurrency(worker.tipsThisMonth)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Savings Goals</p>
                        <p className="text-white">{worker.activeSavingsGoals}</p>
                      </div>
                    </div>
                  </div>

                  {/* WhatsApp row */}
                  <div className="flex items-end gap-3 flex-wrap">
                    <div className="flex-1 min-w-[180px]">
                      <label className="text-xs text-gray-500 block mb-1.5">WhatsApp Number</label>
                      <input
                        value={worker.whatsappNumber ?? ""}
                        onChange={(e) => updateLocalWorker(worker.id, { whatsappNumber: e.target.value })}
                        placeholder="+27 82 000 0000"
                        className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => updateLocalWorker(worker.id, { whatsappOptIn: !worker.whatsappOptIn })}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                        worker.whatsappOptIn ? "bg-emerald-500/15 text-emerald-400" : "bg-gray-800 text-gray-400"
                      }`}
                    >
                      {worker.whatsappOptIn ? "WA On" : "WA Off"}
                    </button>
                    <button
                      type="button"
                      onClick={() => saveWorker(worker)}
                      disabled={rowPending}
                      className="px-3 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-400 disabled:opacity-50 transition-colors"
                    >
                      Save
                    </button>
                  </div>

                  {/* Telegram row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">Telegram:</span>
                      {worker.telegramChatId ? (
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 text-xs font-medium">
                          ✓ Linked
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-gray-800 text-gray-500 text-xs">
                          Not linked
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => triggerTelegramLink(worker)}
                      disabled={rowPending}
                      className="px-3 py-1.5 rounded-xl bg-blue-500/15 text-blue-400 text-xs font-medium hover:bg-blue-500/25 disabled:opacity-50 transition-colors"
                    >
                      {worker.telegramChatId ? "Re-link Telegram" : "Link Telegram"}
                    </button>
                    {worker.telegramChatId && (
                      <button
                        type="button"
                        onClick={() => triggerUnlinkTelegram(worker)}
                        disabled={rowPending}
                        className="px-3 py-1.5 rounded-xl bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                      >
                        Unlink
                      </button>
                    )}
                  </div>

                  {/* Test payslip */}
                  <div>
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
