"use client";

import { useState, useTransition } from "react";
import { createPayrollRun, approvePayrollRun, markPayrollPaid, createEmployee, deleteEmployee } from "@/lib/actions/payroll";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import Link from "next/link";

type Employee = {
  id: string; name: string; jobTitle: string | null; employmentType: string;
  grossSalary: any; isActive: boolean; property: { name: string } | null;
  bankName: string | null; phone: string | null; email: string | null;
};
type PayrollEntry = {
  id: string; grossPay: any; overtime: any; bonus: any; otherAdditions: any;
  uifEmployee: any; uifEmployer: any; paye: any; otherDeductions: any; netPay: any; notes: string | null;
  employee: { name: string; employmentType: string };
};
type PayrollRun = {
  id: string; periodMonth: number; periodYear: number; status: string;
  totalGross: any; totalNet: any; totalUifEmployee: any; totalUifEmployer: any; totalEmployerCost: any;
  paidAt: Date | null; property: { name: string } | null; entries: PayrollEntry[];
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-gray-500/10 text-gray-400",
  APPROVED: "bg-amber-500/10 text-amber-400",
  PAID: "bg-emerald-500/10 text-emerald-400",
};

function fmt(v: any) { return formatCurrency(Number(v)); }

export function PayrollClient({
  runs, employees, properties,
}: {
  runs: PayrollRun[];
  employees: Employee[];
  properties: { id: string; name: string }[];
}) {
  const [tab, setTab] = useState<"runs" | "employees">("runs");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showNewRun, setShowNewRun] = useState(false);
  const [showNewEmployee, setShowNewEmployee] = useState(false);

  // New run form
  const now = new Date();
  const [runMonth, setRunMonth] = useState(now.getMonth() + 1);
  const [runYear, setRunYear] = useState(now.getFullYear());
  const [runPropertyId, setRunPropertyId] = useState(properties[0]?.id ?? "");

  // New employee form
  const [empForm, setEmpForm] = useState({
    name: "", jobTitle: "", employmentType: "FULL_TIME" as "FULL_TIME" | "PART_TIME" | "CONTRACT",
    grossSalary: "", startDate: "", propertyId: properties[0]?.id ?? "",
    phone: "", email: "", bankName: "", bankAccount: "", bankBranch: "", idNumber: "",
  });

  function handleCreateRun() {
    setError(null);
    startTransition(async () => {
      try {
        await createPayrollRun({ periodMonth: runMonth, periodYear: runYear, propertyId: runPropertyId || undefined });
        setShowNewRun(false);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function handleCreateEmployee() {
    setError(null);
    if (!empForm.name || !empForm.grossSalary || !empForm.startDate) {
      setError("Name, salary and start date are required");
      return;
    }
    startTransition(async () => {
      try {
        await createEmployee({
          ...empForm,
          grossSalary: parseFloat(empForm.grossSalary),
          propertyId: empForm.propertyId || undefined,
        });
        setShowNewEmployee(false);
        setEmpForm({ name: "", jobTitle: "", employmentType: "FULL_TIME", grossSalary: "", startDate: "", propertyId: properties[0]?.id ?? "", phone: "", email: "", bankName: "", bankAccount: "", bankBranch: "", idNumber: "" });
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function handleApprove(id: string) {
    startTransition(async () => { await approvePayrollRun(id); });
  }

  function handlePaid(id: string) {
    if (!runPropertyId && !properties[0]?.id) { setError("Select a property first"); return; }
    startTransition(async () => {
      await markPayrollPaid(id, runPropertyId || properties[0]?.id);
    });
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Payroll</h1>
          <p className="text-gray-400 text-sm mt-1">{employees.length} employees · UIF auto-calculated · PAYE exempt (below threshold)</p>
        </div>
        <div className="flex gap-2">
          {tab === "employees" && (
            <button onClick={() => setShowNewEmployee(true)}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-colors">
              + Add Employee
            </button>
          )}
          {tab === "runs" && (
            <button onClick={() => setShowNewRun(true)}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-colors">
              + New Payroll Run
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-900 rounded-xl p-1 w-fit">
        {(["runs", "employees"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("px-5 py-2 rounded-lg text-sm font-medium transition-colors capitalize",
              tab === t ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300")}>
            {t === "runs" ? "Payroll Runs" : "Employees"}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      {/* ── PAYROLL RUNS TAB ── */}
      {tab === "runs" && (
        <div className="space-y-4">
          {runs.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
              <div className="text-4xl mb-3">💸</div>
              <p className="text-gray-400">No payroll runs yet.</p>
              <p className="text-gray-600 text-sm mt-1">Click "New Payroll Run" to process your first payroll.</p>
            </div>
          ) : (
            runs.map((run) => (
              <div key={run.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                {/* Run header */}
                <div className="px-6 py-4 flex items-center justify-between border-b border-gray-800">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-white font-semibold">{MONTHS[run.periodMonth - 1]} {run.periodYear}</p>
                      <p className="text-xs text-gray-500">{run.entries.length} employees{run.property ? ` · ${run.property.name}` : ""}</p>
                    </div>
                    <span className={cn("px-2.5 py-1 rounded-lg text-xs font-semibold", STATUS_COLOR[run.status])}>
                      {run.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="text-xs text-gray-500">Total Gross</p>
                      <p className="text-sm font-semibold text-white">{fmt(run.totalGross)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">UIF (both sides)</p>
                      <p className="text-sm font-semibold text-amber-400">{fmt(Number(run.totalUifEmployee) + Number(run.totalUifEmployer))}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Net Pay (employees)</p>
                      <p className="text-sm font-bold text-emerald-400">{fmt(run.totalNet)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Employer Cost</p>
                      <p className="text-sm font-semibold text-white">{fmt(run.totalEmployerCost)}</p>
                    </div>
                    {/* Actions */}
                    <div className="flex gap-2">
                      <Link href={`/payroll/run/${run.id}`}
                        className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium transition-colors">
                        View / Edit
                      </Link>
                      {run.status === "DRAFT" && (
                        <button onClick={() => handleApprove(run.id)} disabled={isPending}
                          className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-medium transition-colors disabled:opacity-50">
                          Approve
                        </button>
                      )}
                      {run.status === "APPROVED" && (
                        <button onClick={() => handlePaid(run.id)} disabled={isPending}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-medium transition-colors disabled:opacity-50">
                          Mark Paid
                        </button>
                      )}
                      {run.status === "PAID" && run.paidAt && (
                        <span className="text-xs text-emerald-400 self-center">
                          ✓ Paid {new Date(run.paidAt).toLocaleDateString("en-ZA")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Entries preview (collapsed) */}
                <div className="divide-y divide-gray-800/50">
                  {run.entries.map((entry) => (
                    <div key={entry.id} className="px-6 py-3 flex items-center justify-between text-sm">
                      <div>
                        <p className="text-white">{entry.employee.name}</p>
                        <p className="text-xs text-gray-500">{entry.employee.employmentType.replace("_", " ")}</p>
                      </div>
                      <div className="flex gap-8 text-right">
                        <div>
                          <p className="text-xs text-gray-500">Gross</p>
                          <p className="text-gray-300">{fmt(Number(entry.grossPay) + Number(entry.overtime) + Number(entry.bonus) + Number(entry.otherAdditions))}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">UIF (emp)</p>
                          <p className="text-amber-400">-{fmt(entry.uifEmployee)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Net Pay</p>
                          <p className="text-emerald-400 font-semibold">{fmt(entry.netPay)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── EMPLOYEES TAB ── */}
      {tab === "employees" && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {employees.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">👤</div>
              <p className="text-gray-400">No employees yet.</p>
              <button onClick={() => setShowNewEmployee(true)}
                className="mt-4 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-colors">
                Add First Employee
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-6 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider">Gross Salary</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider">UIF (emp)</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider">Net Pay</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider">Property</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {employees.map((emp) => {
                  const gross = Number(emp.grossSalary);
                  const uif = Math.min(gross, 17712) * 0.01;
                  const net = gross - uif;
                  return (
                    <tr key={emp.id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="px-6 py-3">
                        <p className="text-white font-medium">{emp.name}</p>
                        <p className="text-xs text-gray-500">{emp.jobTitle ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2 py-0.5 rounded-md text-xs font-medium",
                          emp.employmentType === "FULL_TIME" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400")}>
                          {emp.employmentType.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{fmt(gross)}</td>
                      <td className="px-4 py-3 text-amber-400">-{fmt(uif)}</td>
                      <td className="px-4 py-3 text-emerald-400 font-semibold">{fmt(net)}</td>
                      <td className="px-4 py-3 text-gray-500">{emp.property?.name ?? "All"}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => { if (confirm(`Remove ${emp.name}?`)) deleteEmployee(emp.id); }}
                          className="text-xs text-gray-600 hover:text-red-400 transition-colors">
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── NEW RUN MODAL ── */}
      {showNewRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4">New Payroll Run</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Month</label>
                  <select value={runMonth} onChange={(e) => setRunMonth(Number(e.target.value))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white">
                    {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Year</label>
                  <input type="number" value={runYear} onChange={(e) => setRunYear(Number(e.target.value))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white" />
                </div>
              </div>
              {properties.length > 1 && (
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Property</label>
                  <select value={runPropertyId} onChange={(e) => setRunPropertyId(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white">
                    <option value="">All Properties</option>
                    {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              <p className="text-xs text-gray-500">This will create a payroll run for all {employees.length} active employees with UIF auto-calculated.</p>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowNewRun(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 text-sm hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleCreateRun} disabled={isPending}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold disabled:opacity-50 transition-colors">
                {isPending ? "Creating..." : "Create Run"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── NEW EMPLOYEE MODAL ── */}
      {showNewEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl my-4">
            <h2 className="text-lg font-bold text-white mb-4">Add Employee</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 mb-1 block">Full Name *</label>
                  <input value={empForm.name} onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white" placeholder="e.g. Thandi Mokoena" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Job Title</label>
                  <input value={empForm.jobTitle} onChange={(e) => setEmpForm({ ...empForm, jobTitle: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white" placeholder="e.g. Housekeeper" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Employment Type *</label>
                  <select value={empForm.employmentType} onChange={(e) => setEmpForm({ ...empForm, employmentType: e.target.value as any })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white">
                    <option value="FULL_TIME">Full Time</option>
                    <option value="PART_TIME">Part Time</option>
                    <option value="CONTRACT">Contract</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Gross Monthly Salary (R) *</label>
                  <input type="number" value={empForm.grossSalary} onChange={(e) => setEmpForm({ ...empForm, grossSalary: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white" placeholder="e.g. 5500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Start Date *</label>
                  <input type="date" value={empForm.startDate} onChange={(e) => setEmpForm({ ...empForm, startDate: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Property</label>
                  <select value={empForm.propertyId} onChange={(e) => setEmpForm({ ...empForm, propertyId: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white">
                    <option value="">All Properties</option>
                    {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">ID Number</label>
                  <input value={empForm.idNumber} onChange={(e) => setEmpForm({ ...empForm, idNumber: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white" placeholder="SA ID number" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Phone</label>
                  <input value={empForm.phone} onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white" placeholder="e.g. 082 000 0000" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Bank Name</label>
                  <input value={empForm.bankName} onChange={(e) => setEmpForm({ ...empForm, bankName: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white" placeholder="e.g. Capitec" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Account Number</label>
                  <input value={empForm.bankAccount} onChange={(e) => setEmpForm({ ...empForm, bankAccount: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white" placeholder="Account number" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowNewEmployee(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 text-sm hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleCreateEmployee} disabled={isPending}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold disabled:opacity-50 transition-colors">
                {isPending ? "Saving..." : "Add Employee"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
