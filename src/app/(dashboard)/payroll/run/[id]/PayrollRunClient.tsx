"use client";

import { useState, useTransition, useRef } from "react";
import { updatePayrollEntry } from "@/lib/actions/payroll";
import { sendPayrollRunPayslips } from "@/app/actions/payroll-whatsapp";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useToast } from "@/context/ToastContext";

type Entry = {
  id: string;
  grossPay: any; overtime: any; bonus: any; otherAdditions: any;
  paye: any; uifEmployee: any; uifEmployer: any; otherDeductions: any;
  netPay: any; notes: string | null;
  employee: { name: string; jobTitle: string | null; employmentType: string; bankName: string | null; bankAccount: string | null; idNumber: string | null };
};
type Run = {
  id: string; periodMonth: number; periodYear: number; status: string;
  totalGross: any; totalNet: any; totalUifEmployee: any; totalUifEmployer: any; totalEmployerCost: any;
  paidAt: Date | null; property: { name: string } | null; entries: Entry[];
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function fmt(v: any) { return formatCurrency(Number(v)); }

export function PayrollRunClient({ run }: { run: Run }) {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<Entry[]>(run.entries);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVals, setEditVals] = useState({ overtime: 0, bonus: 0, otherAdditions: 0, otherDeductions: 0, notes: "" });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const monthName = MONTHS[run.periodMonth - 1];

  function startEdit(entry: Entry) {
    setEditingId(entry.id);
    setEditVals({
      overtime: Number(entry.overtime),
      bonus: Number(entry.bonus),
      otherAdditions: Number(entry.otherAdditions),
      otherDeductions: Number(entry.otherDeductions),
      notes: entry.notes ?? "",
    });
  }

  function saveEdit(entryId: string) {
    setError(null);
    startTransition(async () => {
      const result = await updatePayrollEntry(entryId, editVals);
      if (!result.ok) { setError(result.error); return; }
      // Optimistic: recalc locally (server recalculates authoritatively)
      setEntries((prev) => prev.map((e) => {
        if (e.id !== entryId) return e;
        const gross = Number(e.grossPay);
        const totalGross = gross + editVals.overtime + editVals.bonus + editVals.otherAdditions;
        const uif = parseFloat((Math.min(totalGross, 17712) * 0.01).toFixed(2));
        // PAYE approximation for optimistic update — server uses full SARS brackets
        const annualised = totalGross * 12;
        const annualTax = annualised <= 95750 ? 0 : Math.max(0, annualised * 0.18 - 17235);
        const paye = parseFloat((annualTax / 12).toFixed(2));
        const net = parseFloat((totalGross - paye - uif - editVals.otherDeductions).toFixed(2));
        return { ...e, overtime: editVals.overtime, bonus: editVals.bonus, otherAdditions: editVals.otherAdditions,
          otherDeductions: editVals.otherDeductions, paye, uifEmployee: uif, uifEmployer: uif, netPay: net, notes: editVals.notes };
      }));
      setEditingId(null);
    });
  }

  function printPaySlip(entry: Entry) {
    setPrintingId(entry.id);
    setTimeout(() => {
      window.print();
      setPrintingId(null);
    }, 300);
  }

  function handleSendPayslips() {
    setError(null);
    startTransition(async () => {
      const result = await sendPayrollRunPayslips(run.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      showToast(`Payslips sent: ${result.sent}. Failed: ${result.failed}.`, result.failed > 0 ? "warning" : "success");
    });
  }

  const totalNet = entries.reduce((s, e) => s + Number(e.netPay), 0);
  const totalGross = entries.reduce((s, e) => s + Number(e.grossPay) + Number(e.overtime) + Number(e.bonus) + Number(e.otherAdditions), 0);
  const totalUifEmp = entries.reduce((s, e) => s + Number(e.uifEmployee), 0);
  const totalUifEmr = entries.reduce((s, e) => s + Number(e.uifEmployer), 0);

  const printEntry = entries.find((e) => e.id === printingId);

  return (
    <div>
      {/* Print pay slip — BCEA Section 32 compliant — hidden unless printing */}
      {printEntry && (() => {
        const peGross = Number(printEntry.grossPay) + Number(printEntry.overtime) + Number(printEntry.bonus) + Number(printEntry.otherAdditions);
        const pePaye = Number(printEntry.paye);
        const peUif = Number(printEntry.uifEmployee);
        const peOtherDed = Number(printEntry.otherDeductions);
        const peTotalDed = pePaye + peUif + peOtherDed;
        return (
        <div id="payslip-print" className="hidden print:block fixed inset-0 bg-white text-black p-8 z-[9999]">
          <div className="max-w-lg mx-auto">
            {/* Header */}
            <div className="flex justify-between items-start mb-4 pb-3 border-b-2 border-black">
              <div>
                <h1 className="text-xl font-bold tracking-tight">PAYSLIP</h1>
                <p className="text-sm font-medium">{run.property?.name ?? "MrCA"}</p>
                <p className="text-xs text-gray-500 mt-1">BCEA Section 32 compliant</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold">{monthName} {run.periodYear}</p>
                <p className="text-gray-600">Pay Date: {run.paidAt ? new Date(run.paidAt).toLocaleDateString("en-ZA") : "—"}</p>
              </div>
            </div>

            {/* Employee details */}
            <div className="mb-5 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <div><span className="text-gray-500">Employee:</span> <span className="font-semibold">{printEntry.employee.name}</span></div>
              <div><span className="text-gray-500">Position:</span> {printEntry.employee.jobTitle ?? printEntry.employee.employmentType.replace("_", " ")}</div>
              {printEntry.employee.idNumber && <div><span className="text-gray-500">ID Number:</span> {printEntry.employee.idNumber}</div>}
              <div><span className="text-gray-500">Period:</span> {monthName} {run.periodYear}</div>
            </div>

            {/* Earnings */}
            <table className="w-full text-sm mb-1">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Earnings</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr><td className="py-1.5">Basic Salary</td><td className="py-1.5 text-right">{fmt(printEntry.grossPay)}</td></tr>
                {Number(printEntry.overtime) > 0 && <tr><td className="py-1.5">Overtime</td><td className="py-1.5 text-right">{fmt(printEntry.overtime)}</td></tr>}
                {Number(printEntry.bonus) > 0 && <tr><td className="py-1.5">Bonus</td><td className="py-1.5 text-right">{fmt(printEntry.bonus)}</td></tr>}
                {Number(printEntry.otherAdditions) > 0 && <tr><td className="py-1.5">Tips & Other Additions</td><td className="py-1.5 text-right">{fmt(printEntry.otherAdditions)}</td></tr>}
                <tr className="border-t border-gray-300 font-semibold"><td className="py-2">Total Earnings</td><td className="py-2 text-right">{fmt(peGross)}</td></tr>
              </tbody>
            </table>

            {/* Deductions */}
            <table className="w-full text-sm mb-1">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Deductions</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr><td className="py-1.5">PAYE (Income Tax)</td><td className="py-1.5 text-right">{pePaye > 0 ? fmt(pePaye) : "R 0.00 (below threshold)"}</td></tr>
                <tr><td className="py-1.5">UIF (Employee 1%)</td><td className="py-1.5 text-right">{fmt(peUif)}</td></tr>
                {peOtherDed > 0 && <tr><td className="py-1.5">Advance / Loan Deduction</td><td className="py-1.5 text-right">{fmt(peOtherDed)}</td></tr>}
                <tr className="border-t border-gray-300 font-semibold"><td className="py-2">Total Deductions</td><td className="py-2 text-right">{fmt(peTotalDed)}</td></tr>
              </tbody>
            </table>

            {/* Employer contributions */}
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employer Contributions</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="py-1.5">UIF (Employer 1%)</td><td className="py-1.5 text-right">{fmt(printEntry.uifEmployer)}</td></tr>
              </tbody>
            </table>

            {/* Net pay */}
            <div className="bg-gray-100 rounded-lg p-4 flex justify-between items-center mb-4 border border-gray-300">
              <span className="font-bold text-lg">NET PAY</span>
              <span className="font-bold text-2xl">{fmt(printEntry.netPay)}</span>
            </div>

            {/* Banking details */}
            {printEntry.employee.bankName && (
              <div className="mb-4 text-sm border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Payment Details</p>
                <p>Bank: {printEntry.employee.bankName}</p>
                {printEntry.employee.bankAccount && <p>Account: {printEntry.employee.bankAccount}</p>}
              </div>
            )}

            <div className="mt-6 pt-3 border-t border-gray-200 flex justify-between text-xs text-gray-400">
              <span>Generated by MrCA · Confidential</span>
              <span>BCEA Section 32 · SARS 2025/2026</span>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Back + header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/payroll" className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1">
          ← Back
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">{monthName} {run.periodYear} Payroll</h1>
          <p className="text-gray-400 text-sm">{run.entries.length} employees · {run.property?.name ?? "All Properties"} ·
            <span className={cn("ml-2 px-2 py-0.5 rounded-md text-xs font-semibold",
              run.status === "PAID" ? "bg-emerald-500/10 text-emerald-400" :
              run.status === "APPROVED" ? "bg-amber-500/10 text-amber-400" : "bg-gray-500/10 text-gray-400")}>
              {run.status}
            </span>
          </p>
        </div>
        {run.status === "PAID" && (
          <button
            type="button"
            onClick={handleSendPayslips}
            disabled={isPending}
            className="ml-auto px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-sm font-medium disabled:opacity-50 transition-colors"
          >
            Send Payslips via WhatsApp
          </button>
        )}
      </div>

      {error && <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

      {/* Summary totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Gross", value: fmt(totalGross), color: "text-white" },
          { label: "UIF (both sides)", value: fmt(totalUifEmp + totalUifEmr), color: "text-amber-400" },
          { label: "Net to Employees", value: fmt(totalNet), color: "text-emerald-400" },
          { label: "Total Employer Cost", value: fmt(totalGross + totalUifEmr), color: "text-white" },
        ].map((s) => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={cn("text-lg font-bold", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Entries */}
      <div className="space-y-3">
        {entries.map((entry) => {
          const grossTotal = Number(entry.grossPay) + Number(entry.overtime) + Number(entry.bonus) + Number(entry.otherAdditions);
          const isEditing = editingId === entry.id;
          return (
            <div key={entry.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold">{entry.employee.name}</p>
                  <p className="text-xs text-gray-500">{entry.employee.jobTitle ?? entry.employee.employmentType.replace("_", " ")}</p>
                </div>
                <div className="flex items-center gap-6 text-right">
                  <div>
                    <p className="text-xs text-gray-500">Gross</p>
                    <p className="text-sm text-gray-300">{fmt(grossTotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">UIF (emp)</p>
                    <p className="text-sm text-amber-400">-{fmt(entry.uifEmployee)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">PAYE</p>
                    <p className={cn("text-sm", Number(entry.paye) > 0 ? "text-amber-400" : "text-gray-500")}>{Number(entry.paye) > 0 ? `-${fmt(entry.paye)}` : "R0.00"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Net Pay</p>
                    <p className="text-base font-bold text-emerald-400">{fmt(entry.netPay)}</p>
                  </div>
                  <div className="flex gap-2">
                    {run.status === "DRAFT" && !isEditing && (
                      <button onClick={() => startEdit(entry)}
                        className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium transition-colors">
                        Edit
                      </button>
                    )}
                    <button onClick={() => printPaySlip(entry)}
                      className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium transition-colors">
                      🖨 Pay Slip
                    </button>
                  </div>
                </div>
              </div>

              {/* Edit form */}
              {isEditing && (
                <div className="border-t border-gray-800 px-6 py-4 bg-gray-800/30">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                    {[
                      { label: "Overtime (R)", key: "overtime" },
                      { label: "Bonus (R)", key: "bonus" },
                      { label: "Other Additions (R)", key: "otherAdditions" },
                      { label: "Other Deductions (R)", key: "otherDeductions" },
                    ].map(({ label, key }) => (
                      <div key={key}>
                        <label className="text-xs text-gray-400 mb-1 block">{label}</label>
                        <input type="number" min={0}
                          value={(editVals as any)[key]}
                          onChange={(e) => setEditVals({ ...editVals, [key]: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white" />
                      </div>
                    ))}
                  </div>
                  <div className="mb-3">
                    <label className="text-xs text-gray-400 mb-1 block">Notes</label>
                    <input value={editVals.notes} onChange={(e) => setEditVals({ ...editVals, notes: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white" placeholder="Optional notes" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingId(null)} className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 text-xs hover:text-white transition-colors">Cancel</button>
                    <button onClick={() => saveEdit(entry.id)} disabled={isPending}
                      className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold disabled:opacity-50 transition-colors">
                      {isPending ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
