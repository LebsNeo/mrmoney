"use client";

import { useState, useTransition, useRef } from "react";
import { updatePayrollEntry } from "@/lib/actions/payroll";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { cn } from "@/lib/utils";

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
      // Optimistic: recalc locally
      setEntries((prev) => prev.map((e) => {
        if (e.id !== entryId) return e;
        const gross = Number(e.grossPay);
        const totalGross = gross + editVals.overtime + editVals.bonus + editVals.otherAdditions;
        const uif = parseFloat((Math.min(totalGross, 17712) * 0.01).toFixed(2));
        const net = parseFloat((totalGross - uif - editVals.otherDeductions).toFixed(2));
        return { ...e, overtime: editVals.overtime, bonus: editVals.bonus, otherAdditions: editVals.otherAdditions,
          otherDeductions: editVals.otherDeductions, uifEmployee: uif, uifEmployer: uif, netPay: net, notes: editVals.notes };
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

  const totalNet = entries.reduce((s, e) => s + Number(e.netPay), 0);
  const totalGross = entries.reduce((s, e) => s + Number(e.grossPay) + Number(e.overtime) + Number(e.bonus) + Number(e.otherAdditions), 0);
  const totalUifEmp = entries.reduce((s, e) => s + Number(e.uifEmployee), 0);
  const totalUifEmr = entries.reduce((s, e) => s + Number(e.uifEmployer), 0);

  const printEntry = entries.find((e) => e.id === printingId);

  return (
    <div>
      {/* Print pay slip — hidden unless printing */}
      {printEntry && (
        <div id="payslip-print" className="hidden print:block fixed inset-0 bg-white text-black p-8 z-[9999]">
          <div className="max-w-md mx-auto">
            <div className="flex justify-between items-start mb-6 pb-4 border-b">
              <div>
                <h1 className="text-xl font-bold">PAY SLIP</h1>
                <p className="text-sm text-gray-600">{run.property?.name ?? "MrMoney"}</p>
              </div>
              <div className="text-right text-sm text-gray-600">
                <p>{monthName} {run.periodYear}</p>
                <p>Pay Date: {run.paidAt ? new Date(run.paidAt).toLocaleDateString("en-ZA") : "—"}</p>
              </div>
            </div>
            <div className="mb-6">
              <p className="font-semibold text-lg">{printEntry.employee.name}</p>
              <p className="text-sm text-gray-600">{printEntry.employee.jobTitle ?? printEntry.employee.employmentType.replace("_", " ")}</p>
              {printEntry.employee.idNumber && <p className="text-sm text-gray-500">ID: {printEntry.employee.idNumber}</p>}
            </div>
            <table className="w-full text-sm mb-6">
              <tbody className="divide-y divide-gray-200">
                <tr><td className="py-2 text-gray-600">Basic Salary</td><td className="py-2 text-right font-medium">{fmt(printEntry.grossPay)}</td></tr>
                {Number(printEntry.overtime) > 0 && <tr><td className="py-2 text-gray-600">Overtime</td><td className="py-2 text-right">{fmt(printEntry.overtime)}</td></tr>}
                {Number(printEntry.bonus) > 0 && <tr><td className="py-2 text-gray-600">Bonus</td><td className="py-2 text-right">{fmt(printEntry.bonus)}</td></tr>}
                {Number(printEntry.otherAdditions) > 0 && <tr><td className="py-2 text-gray-600">Other Additions</td><td className="py-2 text-right">{fmt(printEntry.otherAdditions)}</td></tr>}
                <tr className="font-semibold"><td className="py-2">Gross Pay</td><td className="py-2 text-right">{fmt(Number(printEntry.grossPay) + Number(printEntry.overtime) + Number(printEntry.bonus) + Number(printEntry.otherAdditions))}</td></tr>
                <tr className="text-red-600"><td className="py-2">UIF (Employee 1%)</td><td className="py-2 text-right">-{fmt(printEntry.uifEmployee)}</td></tr>
                <tr><td className="py-2 text-gray-600">PAYE</td><td className="py-2 text-right">R0.00 (below threshold)</td></tr>
                {Number(printEntry.otherDeductions) > 0 && <tr className="text-red-600"><td className="py-2">Other Deductions</td><td className="py-2 text-right">-{fmt(printEntry.otherDeductions)}</td></tr>}
              </tbody>
            </table>
            <div className="bg-gray-100 rounded-lg p-4 flex justify-between items-center">
              <span className="font-bold text-lg">NET PAY</span>
              <span className="font-bold text-2xl">{fmt(printEntry.netPay)}</span>
            </div>
            {printEntry.employee.bankName && (
              <div className="mt-4 text-sm text-gray-500">
                <p>Bank: {printEntry.employee.bankName}</p>
                {printEntry.employee.bankAccount && <p>Account: {printEntry.employee.bankAccount}</p>}
              </div>
            )}
            <p className="mt-6 text-xs text-gray-400 text-center">Generated by MrMoney · Confidential</p>
          </div>
        </div>
      )}

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
                    <p className="text-sm text-gray-500">R0.00</p>
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
