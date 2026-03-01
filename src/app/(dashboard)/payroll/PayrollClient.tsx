"use client";

import { useState, useTransition } from "react";
import {
  createPayrollRun, approvePayrollRun, markPayrollPaid,
  createEmployee, deleteEmployee,
} from "@/lib/actions/payroll";
import { recordAdvance, settleAdvanceManually } from "@/lib/actions/advances";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import Link from "next/link";

type Employee = {
  id: string; name: string; jobTitle: string | null; employmentType: string;
  grossSalary: number; isActive: boolean; property: { name: string } | null;
  bankName: string | null; phone: string | null; email: string | null;
};
type Advance = {
  id: string; employeeId: string; type: string; amount: number;
  monthlyInstalment: number | null; remainingBalance: number; status: string;
  givenDate: string; notes: string | null;
  employee: { name: string; grossSalary: number };
};
type PayrollEntry = {
  id: string; grossPay: number; overtime: number; bonus: number; otherAdditions: number;
  uifEmployee: number; uifEmployer: number; paye: number; otherDeductions: number;
  netPay: number; notes: string | null;
  employee: { name: string; employmentType: string };
};
type PayrollRun = {
  id: string; periodMonth: number; periodYear: number; status: string;
  totalGross: number; totalNet: number; totalUifEmployee: number;
  totalUifEmployer: number; totalEmployerCost: number;
  paidAt: string | null; property: { name: string } | null; entries: PayrollEntry[];
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-gray-500/10 text-gray-400",
  APPROVED: "bg-amber-500/10 text-amber-400",
  PAID: "bg-emerald-500/10 text-emerald-400",
};
function fmt(v: number | string) { return formatCurrency(Number(v)); }

export function PayrollClient({
  runs, employees, advances, properties,
}: {
  runs: PayrollRun[];
  employees: Employee[];
  advances: Advance[];
  properties: { id: string; name: string }[];
}) {
  const [tab, setTab] = useState<"runs" | "employees" | "advances">("runs");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showNewRun, setShowNewRun] = useState(false);
  const [showNewEmployee, setShowNewEmployee] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);

  const now = new Date();
  const [runMonth, setRunMonth] = useState(now.getMonth() + 1);
  const [runYear, setRunYear] = useState(now.getFullYear());
  const [runPropertyId, setRunPropertyId] = useState(properties[0]?.id ?? "");

  const [empForm, setEmpForm] = useState({
    name: "", jobTitle: "", employmentType: "FULL_TIME" as "FULL_TIME" | "PART_TIME" | "CONTRACT",
    grossSalary: "", startDate: "", propertyId: properties[0]?.id ?? "",
    phone: "", email: "", bankName: "", bankAccount: "", bankBranch: "", idNumber: "",
  });

  const [advForm, setAdvForm] = useState({
    employeeId: "", propertyId: properties[0]?.id ?? "",
    type: "ADVANCE" as "ADVANCE" | "LOAN",
    amount: "", monthlyInstalment: "",
    givenDate: now.toISOString().split("T")[0], notes: "",
  });

  function notify(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  }

  function handleCreateRun() {
    setError(null);
    startTransition(async () => {
      const result = await createPayrollRun({ periodMonth: runMonth, periodYear: runYear, propertyId: runPropertyId || undefined });
      if (!result.ok) { setError(result.error); return; }
      setShowNewRun(false);
      notify(`Payroll run for ${MONTHS[runMonth - 1]} ${runYear} created.`);
    });
  }

  function handleCreateEmployee() {
    setError(null);
    if (!empForm.name.trim()) { setError("Employee name is required"); return; }
    if (!empForm.grossSalary || parseFloat(empForm.grossSalary) <= 0) { setError("Please enter a valid gross salary"); return; }
    if (!empForm.startDate) { setError("Start date is required"); return; }
    startTransition(async () => {
      const result = await createEmployee({ ...empForm, grossSalary: parseFloat(empForm.grossSalary), propertyId: empForm.propertyId || undefined });
      if (!result.ok) { setError(result.error); return; }
      setShowNewEmployee(false);
      setEmpForm({ name: "", jobTitle: "", employmentType: "FULL_TIME", grossSalary: "", startDate: "", propertyId: properties[0]?.id ?? "", phone: "", email: "", bankName: "", bankAccount: "", bankBranch: "", idNumber: "" });
      notify(`${empForm.name} added successfully.`);
    });
  }

  function handleRecordAdvance() {
    setError(null);
    if (!advForm.employeeId) { setError("Select an employee"); return; }
    if (!advForm.amount || parseFloat(advForm.amount) <= 0) { setError("Enter a valid amount"); return; }
    if (advForm.type === "LOAN" && (!advForm.monthlyInstalment || parseFloat(advForm.monthlyInstalment) <= 0)) {
      setError("Monthly instalment is required for a loan"); return;
    }
    startTransition(async () => {
      const result = await recordAdvance({
        employeeId: advForm.employeeId,
        propertyId: advForm.propertyId,
        type: advForm.type,
        amount: parseFloat(advForm.amount),
        monthlyInstalment: advForm.monthlyInstalment ? parseFloat(advForm.monthlyInstalment) : undefined,
        givenDate: advForm.givenDate,
        notes: advForm.notes,
      });
      if (!result.ok) { setError(result.error); return; }
      setShowAdvanceModal(false);
      setAdvForm({ employeeId: "", propertyId: properties[0]?.id ?? "", type: "ADVANCE", amount: "", monthlyInstalment: "", givenDate: now.toISOString().split("T")[0], notes: "" });
      notify("Advance recorded and cash outflow posted to transactions.");
    });
  }

  function handleApprove(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await approvePayrollRun(id);
      if (!result.ok) setError(result.error);
      else notify("Payroll run approved.");
    });
  }

  function handlePaid(id: string) {
    setError(null);
    const propId = runPropertyId || properties[0]?.id;
    if (!propId) { setError("Please select a property before marking as paid"); return; }
    startTransition(async () => {
      const result = await markPayrollPaid(id, propId);
      if (!result.ok) setError(result.error);
      else notify("Payroll paid! Expenses posted to transactions. Advance balances updated.");
    });
  }

  function handleSettleAdvance(id: string) {
    startTransition(async () => {
      const result = await settleAdvanceManually(id);
      if (!result.ok) setError(result.error);
      else notify("Advance marked as settled.");
    });
  }

  const activeAdvances = advances.filter((a) => a.status === "ACTIVE");
  const settledAdvances = advances.filter((a) => a.status === "SETTLED");

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Payroll</h1>
          <p className="text-gray-400 text-sm mt-1">
            {employees.length} employees ·{" "}
            {activeAdvances.length > 0 && <span className="text-amber-400">{activeAdvances.length} active advance{activeAdvances.length !== 1 ? "s" : ""} · </span>}
            UIF auto-calculated · PAYE exempt
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {tab === "advances" && (
            <button onClick={() => setShowAdvanceModal(true)} disabled={employees.length === 0}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              + Record Advance / Loan
            </button>
          )}
          {tab === "employees" && (
            <button onClick={() => setShowNewEmployee(true)}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-colors">
              + Add Employee
            </button>
          )}
          {tab === "runs" && (
            <button
              onClick={() => employees.length === 0 ? setTab("employees") : setShowNewRun(true)}
              className={cn("px-4 py-2 rounded-xl text-sm font-semibold transition-colors",
                employees.length === 0 ? "bg-gray-700 text-gray-400" : "bg-emerald-500 hover:bg-emerald-400 text-white")}>
              {employees.length === 0 ? "Add Employees First →" : "+ New Payroll Run"}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-900 rounded-xl p-1 w-fit">
        {(["runs", "employees", "advances"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize relative",
              tab === t ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300")}>
            {t === "runs" ? "Payroll Runs" : t === "employees" ? "Employees" : "Advances & Loans"}
            {t === "advances" && activeAdvances.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                {activeAdvances.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications */}
      {success && <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">{success}</div>}
      {error && <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

      {/* ── PAYROLL RUNS TAB ── */}
      {tab === "runs" && (
        <div className="space-y-4">
          {runs.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
              <div className="text-4xl mb-3">💸</div>
              <p className="text-white font-semibold mb-1">No payroll runs yet</p>
              {employees.length === 0 ? (
                <>
                  <p className="text-gray-400 text-sm">Add your employees before running payroll.</p>
                  <button onClick={() => setTab("employees")} className="mt-4 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-colors">→ Add Employees First</button>
                </>
              ) : (
                <>
                  <p className="text-gray-400 text-sm">{employees.length} employee{employees.length !== 1 ? "s" : ""} ready.</p>
                  <button onClick={() => setShowNewRun(true)} className="mt-4 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-colors">+ New Payroll Run</button>
                </>
              )}
            </div>
          ) : (
            runs.map((run) => (
              <div key={run.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-gray-800">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-white font-semibold">{MONTHS[run.periodMonth - 1]} {run.periodYear}</p>
                      <p className="text-xs text-gray-500">{run.entries.length} employees{run.property ? ` · ${run.property.name}` : ""}</p>
                    </div>
                    <span className={cn("px-2.5 py-1 rounded-lg text-xs font-semibold", STATUS_COLOR[run.status])}>{run.status}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Gross</p>
                      <p className="text-sm font-semibold text-white">{fmt(run.totalGross)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Net to employees</p>
                      <p className="text-sm font-bold text-emerald-400">{fmt(run.totalNet)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Employer cost</p>
                      <p className="text-sm text-white">{fmt(run.totalEmployerCost)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/payroll/run/${run.id}`} className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium transition-colors">View / Edit</Link>
                      {run.status === "DRAFT" && <button onClick={() => handleApprove(run.id)} disabled={isPending} className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-medium transition-colors disabled:opacity-50">Approve</button>}
                      {run.status === "APPROVED" && <button onClick={() => handlePaid(run.id)} disabled={isPending} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-medium transition-colors disabled:opacity-50">Mark Paid</button>}
                      {run.status === "PAID" && run.paidAt && <span className="text-xs text-emerald-400 self-center">✓ Paid {new Date(run.paidAt).toLocaleDateString("en-ZA")}</span>}
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-gray-800/50">
                  {run.entries.map((entry) => (
                    <div key={entry.id} className="px-6 py-3 flex items-center justify-between gap-4 text-sm">
                      <div>
                        <p className="text-white">{entry.employee.name}</p>
                        <p className="text-xs text-gray-500">{entry.employee.employmentType.replace("_", " ")}</p>
                      </div>
                      <div className="flex gap-6 text-right flex-wrap">
                        <div><p className="text-xs text-gray-500">Gross</p><p className="text-gray-300">{fmt(entry.grossPay + entry.overtime + entry.bonus + entry.otherAdditions)}</p></div>
                        {entry.otherDeductions > 0 && <div><p className="text-xs text-gray-500">Advance deduction</p><p className="text-amber-400">-{fmt(entry.otherDeductions)}</p></div>}
                        <div><p className="text-xs text-gray-500">UIF (emp)</p><p className="text-amber-400">-{fmt(entry.uifEmployee)}</p></div>
                        <div><p className="text-xs text-gray-500">Net Pay</p><p className="text-emerald-400 font-semibold">{fmt(entry.netPay)}</p></div>
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
              <button onClick={() => setShowNewEmployee(true)} className="mt-4 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-colors">Add First Employee</button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {["Name", "Type", "Gross Salary", "UIF (emp)", "Net Pay", "Outstanding Advance", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider first:pl-6">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {employees.map((emp) => {
                  const gross = Number(emp.grossSalary);
                  const uif = Math.min(gross, 17712) * 0.01;
                  const net = gross - uif;
                  const empAdvances = activeAdvances.filter((a) => a.employeeId === emp.id);
                  const totalOwed = empAdvances.reduce((s, a) => s + a.remainingBalance, 0);
                  return (
                    <tr key={emp.id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="px-6 py-3"><p className="text-white font-medium">{emp.name}</p><p className="text-xs text-gray-500">{emp.jobTitle ?? "—"}</p></td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2 py-0.5 rounded-md text-xs font-medium", emp.employmentType === "FULL_TIME" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400")}>
                          {emp.employmentType.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{fmt(gross)}</td>
                      <td className="px-4 py-3 text-amber-400">-{fmt(uif)}</td>
                      <td className="px-4 py-3 text-emerald-400 font-semibold">{fmt(net)}</td>
                      <td className="px-4 py-3">
                        {totalOwed > 0
                          ? <span className="text-amber-400 font-medium">{fmt(totalOwed)}</span>
                          : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => { setAdvForm((f) => ({ ...f, employeeId: emp.id })); setShowAdvanceModal(true); setTab("advances"); }}
                            className="text-xs text-amber-400 hover:text-amber-300 transition-colors font-medium">+ Advance</button>
                          <button onClick={() => { if (confirm(`Remove ${emp.name}?`)) deleteEmployee(emp.id); }}
                            className="text-xs text-gray-600 hover:text-red-400 transition-colors">Remove</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── ADVANCES TAB ── */}
      {tab === "advances" && (
        <div className="space-y-4">
          {advances.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
              <div className="text-4xl mb-3">🤝</div>
              <p className="text-white font-semibold mb-1">No advances or loans recorded</p>
              <p className="text-gray-400 text-sm">When an employee borrows money or requests a salary advance, record it here. Cash goes out immediately and is deducted at payroll.</p>
              {employees.length > 0 && (
                <button onClick={() => setShowAdvanceModal(true)} className="mt-4 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold transition-colors">
                  + Record First Advance
                </button>
              )}
            </div>
          ) : (
            <>
              {activeAdvances.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Active</h2>
                  <div className="space-y-3">
                    {activeAdvances.map((adv) => (
                      <div key={adv.id} className="bg-gray-900 border border-amber-500/20 rounded-2xl p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <p className="text-white font-semibold">{adv.employee.name}</p>
                              <span className={cn("px-2 py-0.5 rounded-md text-xs font-semibold", adv.type === "LOAN" ? "bg-purple-500/10 text-purple-400" : "bg-amber-500/10 text-amber-400")}>
                                {adv.type === "LOAN" ? "Loan" : "Salary Advance"}
                              </span>
                            </div>
                            {adv.notes && <p className="text-xs text-gray-500 mb-2">{adv.notes}</p>}
                            <div className="flex gap-6 flex-wrap">
                              <div><p className="text-xs text-gray-500">Original</p><p className="text-sm text-gray-300">{fmt(adv.amount)}</p></div>
                              <div><p className="text-xs text-gray-500">Remaining</p><p className="text-sm font-bold text-amber-400">{fmt(adv.remainingBalance)}</p></div>
                              {adv.monthlyInstalment && <div><p className="text-xs text-gray-500">Monthly deduction</p><p className="text-sm text-gray-300">{fmt(adv.monthlyInstalment)}</p></div>}
                              <div><p className="text-xs text-gray-500">Given</p><p className="text-sm text-gray-300">{new Date(adv.givenDate).toLocaleDateString("en-ZA")}</p></div>
                            </div>
                            {/* Repayment progress bar */}
                            <div className="mt-3">
                              <div className="w-full bg-gray-800 rounded-full h-1.5">
                                <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, ((adv.amount - adv.remainingBalance) / adv.amount) * 100)).toFixed(0)}%` }} />
                              </div>
                              <p className="text-xs text-gray-600 mt-1">{(((adv.amount - adv.remainingBalance) / adv.amount) * 100).toFixed(0)}% repaid</p>
                            </div>
                          </div>
                          <button onClick={() => { if (confirm("Mark this advance as fully settled?")) handleSettleAdvance(adv.id); }}
                            className="text-xs text-gray-600 hover:text-emerald-400 transition-colors shrink-0">Write off</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {settledAdvances.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3 mt-6">Settled</h2>
                  <div className="space-y-2">
                    {settledAdvances.map((adv) => (
                      <div key={adv.id} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-3 flex items-center justify-between opacity-60">
                        <div className="flex items-center gap-4">
                          <p className="text-gray-400 text-sm">{adv.employee.name}</p>
                          <span className="text-xs text-gray-600">{adv.type === "LOAN" ? "Loan" : "Advance"} · {fmt(adv.amount)}</span>
                        </div>
                        <span className="text-xs text-emerald-600">✓ Settled</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── NEW RUN MODAL ── */}
      {showNewRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-1">New Payroll Run</h2>
            <p className="text-xs text-gray-500 mb-4">
              {activeAdvances.length > 0
                ? `⚠ ${activeAdvances.length} active advance${activeAdvances.length !== 1 ? "s" : ""} will be auto-suggested as deductions. Review them in View / Edit before approving.`
                : "All active employees will be included. UIF auto-calculated."}
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Month</label>
                  <select value={runMonth} onChange={(e) => setRunMonth(Number(e.target.value))} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white">
                    {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Year</label>
                  <input type="number" value={runYear} onChange={(e) => setRunYear(Number(e.target.value))} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white" />
                </div>
              </div>
              {properties.length > 1 && (
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Property</label>
                  <select value={runPropertyId} onChange={(e) => setRunPropertyId(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white">
                    <option value="">All Properties</option>
                    {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowNewRun(false)} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 text-sm hover:text-white transition-colors">Cancel</button>
              <button onClick={handleCreateRun} disabled={isPending} className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold disabled:opacity-50 transition-colors">
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
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="text-xs text-gray-400 mb-1 block">Full Name *</label><input value={empForm.name} onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white" placeholder="e.g. Thandi Mokoena" /></div>
              <div><label className="text-xs text-gray-400 mb-1 block">Job Title</label><input value={empForm.jobTitle} onChange={(e) => setEmpForm({ ...empForm, jobTitle: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white" placeholder="e.g. Housekeeper" /></div>
              <div><label className="text-xs text-gray-400 mb-1 block">Employment Type *</label><select value={empForm.employmentType} onChange={(e) => setEmpForm({ ...empForm, employmentType: e.target.value as any })} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white"><option value="FULL_TIME">Full Time</option><option value="PART_TIME">Part Time</option><option value="CONTRACT">Contract</option></select></div>
              <div><label className="text-xs text-gray-400 mb-1 block">Gross Monthly Salary (R) *</label><input type="number" value={empForm.grossSalary} onChange={(e) => setEmpForm({ ...empForm, grossSalary: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white" placeholder="e.g. 5500" /></div>
              <div><label className="text-xs text-gray-400 mb-1 block">Start Date *</label><input type="date" value={empForm.startDate} onChange={(e) => setEmpForm({ ...empForm, startDate: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white" /></div>
              <div><label className="text-xs text-gray-400 mb-1 block">Property</label><select value={empForm.propertyId} onChange={(e) => setEmpForm({ ...empForm, propertyId: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white"><option value="">All Properties</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div><label className="text-xs text-gray-400 mb-1 block">ID Number</label><input value={empForm.idNumber} onChange={(e) => setEmpForm({ ...empForm, idNumber: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white" placeholder="SA ID number" /></div>
              <div><label className="text-xs text-gray-400 mb-1 block">Phone</label><input value={empForm.phone} onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white" placeholder="e.g. 082 000 0000" /></div>
              <div><label className="text-xs text-gray-400 mb-1 block">Bank Name</label><input value={empForm.bankName} onChange={(e) => setEmpForm({ ...empForm, bankName: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white" placeholder="e.g. Capitec" /></div>
              <div><label className="text-xs text-gray-400 mb-1 block">Account Number</label><input value={empForm.bankAccount} onChange={(e) => setEmpForm({ ...empForm, bankAccount: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white" placeholder="Account number" /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowNewEmployee(false)} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 text-sm hover:text-white transition-colors">Cancel</button>
              <button onClick={handleCreateEmployee} disabled={isPending} className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold disabled:opacity-50 transition-colors">{isPending ? "Saving..." : "Add Employee"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADVANCE / LOAN MODAL ── */}
      {showAdvanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-1">Record Advance / Loan</h2>
            <p className="text-xs text-gray-500 mb-4">Cash out is posted immediately as <span className="text-amber-400">Employee Advance</span> (not salary). The deduction will be suggested at payroll time.</p>

            {/* Type toggle */}
            <div className="flex gap-1 bg-gray-800 rounded-xl p-1 mb-4">
              {(["ADVANCE", "LOAN"] as const).map((t) => (
                <button key={t} onClick={() => setAdvForm({ ...advForm, type: t })}
                  className={cn("flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
                    advForm.type === t ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300")}>
                  {t === "ADVANCE" ? "💰 Salary Advance" : "🤝 Loan (instalments)"}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Employee *</label>
                <select value={advForm.employeeId} onChange={(e) => setAdvForm({ ...advForm, employeeId: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white">
                  <option value="">Select employee...</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name} (salary: {fmt(Number(e.grossSalary))})</option>)}
                </select>
              </div>
              {properties.length > 1 && (
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Property (for cash outflow) *</label>
                  <select value={advForm.propertyId} onChange={(e) => setAdvForm({ ...advForm, propertyId: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white">
                    {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Amount (R) *</label>
                  <input type="number" min={0} value={advForm.amount} onChange={(e) => setAdvForm({ ...advForm, amount: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white" placeholder="e.g. 1500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Date Given *</label>
                  <input type="date" value={advForm.givenDate} onChange={(e) => setAdvForm({ ...advForm, givenDate: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white" />
                </div>
              </div>
              {advForm.type === "LOAN" && (
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Monthly Instalment (R) *</label>
                  <input type="number" min={0} value={advForm.monthlyInstalment} onChange={(e) => setAdvForm({ ...advForm, monthlyInstalment: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white" placeholder="e.g. 500" />
                  {advForm.amount && advForm.monthlyInstalment && (
                    <p className="text-xs text-gray-500 mt-1">
                      Repaid over ~{Math.ceil(parseFloat(advForm.amount) / parseFloat(advForm.monthlyInstalment))} month{Math.ceil(parseFloat(advForm.amount) / parseFloat(advForm.monthlyInstalment)) !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              )}
              {advForm.type === "ADVANCE" && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
                  <p className="text-xs text-amber-400">Full amount will be deducted from their next payroll run.</p>
                </div>
              )}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Notes (optional)</label>
                <input value={advForm.notes} onChange={(e) => setAdvForm({ ...advForm, notes: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white" placeholder="e.g. Emergency medical" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAdvanceModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 text-sm hover:text-white transition-colors">Cancel</button>
              <button onClick={handleRecordAdvance} disabled={isPending}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold disabled:opacity-50 transition-colors">
                {isPending ? "Recording..." : "Record & Post Cash Out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
