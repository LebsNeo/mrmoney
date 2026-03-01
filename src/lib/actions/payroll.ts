"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { TransactionCategory, TransactionType, TransactionStatus, TransactionSource } from "@prisma/client";

// ─── UIF constants (2025) ─────────────────────────────────────────────────
const UIF_RATE = 0.01;
const UIF_CAP = 17712; // Monthly remuneration cap

function calcUIF(gross: number): number {
  return parseFloat((Math.min(gross, UIF_CAP) * UIF_RATE).toFixed(2));
}

function calcNet(gross: number, overtime: number, bonus: number, additions: number, uifEmp: number, otherDed: number): number {
  return parseFloat((gross + overtime + bonus + additions - uifEmp - otherDed).toFixed(2));
}

// ─── Serialize Decimal/Date → plain JS (required for Server→Client boundary)
function serialize<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_k, v) => {
    if (v !== null && typeof v === "object" && typeof v.toFixed === "function") return Number(v);
    if (v instanceof Date) return v.toISOString();
    return v;
  }));
}

async function getOrgId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as { organisationId?: string })?.organisationId ?? null;
}

// ─── Result types ──────────────────────────────────────────────────────────
type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

// ─── EMPLOYEES ─────────────────────────────────────────────────────────────

export async function getEmployees(propertyId?: string) {
  const orgId = await getOrgId();
  if (!orgId) return [];
  const rows = await prisma.employee.findMany({
    where: { organisationId: orgId, isActive: true, deletedAt: null, ...(propertyId ? { propertyId } : {}) },
    include: { property: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  return serialize(rows);
}

export async function createEmployee(data: {
  name: string;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT";
  jobTitle?: string;
  grossSalary: number;
  startDate: string;
  propertyId?: string;
  idNumber?: string;
  email?: string;
  phone?: string;
  bankName?: string;
  bankAccount?: string;
  bankBranch?: string;
  notes?: string;
}): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    const orgId = await getOrgId();
    if (!orgId) return { ok: false, error: "Not authenticated" };

    if (!data.name?.trim()) return { ok: false, error: "Employee name is required" };
    if (!data.grossSalary || data.grossSalary <= 0) return { ok: false, error: "Gross salary must be greater than zero" };
    if (!data.startDate) return { ok: false, error: "Start date is required" };
    if (data.grossSalary > 500000) return { ok: false, error: "Salary seems unusually high — please double-check (monthly, not annual)" };

    const employee = await prisma.employee.create({
      data: {
        organisationId: orgId,
        name: data.name.trim(),
        employmentType: data.employmentType,
        jobTitle: data.jobTitle?.trim() ?? null,
        grossSalary: data.grossSalary,
        startDate: new Date(data.startDate),
        propertyId: data.propertyId || null,
        idNumber: data.idNumber?.trim() || null,
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        bankName: data.bankName?.trim() || null,
        bankAccount: data.bankAccount?.trim() || null,
        bankBranch: data.bankBranch?.trim() || null,
        notes: data.notes?.trim() || null,
      },
    });
    revalidatePath("/payroll");
    return { ok: true, data: { id: employee.id, name: employee.name } };
  } catch (e: any) {
    console.error("createEmployee error:", e);
    return { ok: false, error: "Failed to save employee. Please try again." };
  }
}

export async function updateEmployee(id: string, data: Partial<{
  name: string; employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT";
  jobTitle: string; grossSalary: number; startDate: string; propertyId: string;
  idNumber: string; email: string; phone: string; bankName: string;
  bankAccount: string; bankBranch: string; isActive: boolean; notes: string;
}>): Promise<ActionResult> {
  try {
    const orgId = await getOrgId();
    if (!orgId) return { ok: false, error: "Not authenticated" };
    await prisma.employee.update({
      where: { id, organisationId: orgId },
      data: { ...data, ...(data.startDate ? { startDate: new Date(data.startDate) } : {}) },
    });
    revalidatePath("/payroll");
    return { ok: true, data: undefined };
  } catch (e: any) {
    return { ok: false, error: "Failed to update employee." };
  }
}

export async function deleteEmployee(id: string): Promise<ActionResult> {
  try {
    const orgId = await getOrgId();
    if (!orgId) return { ok: false, error: "Not authenticated" };
    await prisma.employee.update({
      where: { id, organisationId: orgId },
      data: { isActive: false, deletedAt: new Date() },
    });
    revalidatePath("/payroll");
    return { ok: true, data: undefined };
  } catch (e: any) {
    return { ok: false, error: "Failed to remove employee." };
  }
}

// ─── PAYROLL RUNS ──────────────────────────────────────────────────────────

export async function getPayrollRuns() {
  const orgId = await getOrgId();
  if (!orgId) return [];
  const rows = await prisma.payrollRun.findMany({
    where: { organisationId: orgId },
    include: {
      entries: { include: { employee: { select: { name: true, employmentType: true } } } },
      property: { select: { name: true } },
    },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
  });
  return serialize(rows);
}

export async function getPayrollRun(id: string) {
  const orgId = await getOrgId();
  if (!orgId) return null;
  const row = await prisma.payrollRun.findFirst({
    where: { id, organisationId: orgId },
    include: {
      entries: {
        include: {
          employee: { select: { name: true, jobTitle: true, employmentType: true, bankName: true, bankAccount: true, idNumber: true } },
        },
        orderBy: { employee: { name: "asc" } },
      },
      property: { select: { name: true } },
    },
  });
  return row ? serialize(row) : null;
}

export async function createPayrollRun(data: {
  periodMonth: number;
  periodYear: number;
  propertyId?: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const orgId = await getOrgId();
    if (!orgId) return { ok: false, error: "Not authenticated" };

    // Validate inputs
    if (!data.periodMonth || data.periodMonth < 1 || data.periodMonth > 12)
      return { ok: false, error: "Invalid month selected" };
    if (!data.periodYear || data.periodYear < 2020 || data.periodYear > 2030)
      return { ok: false, error: "Invalid year" };

    // Check for duplicate run
    const existing = await prisma.payrollRun.findFirst({
      where: {
        organisationId: orgId,
        periodMonth: data.periodMonth,
        periodYear: data.periodYear,
        propertyId: data.propertyId || null,
      },
    });
    if (existing) {
      const month = new Date(data.periodYear, data.periodMonth - 1).toLocaleString("en-ZA", { month: "long" });
      return { ok: false, error: `A payroll run for ${month} ${data.periodYear} already exists. You can edit or view it in the list.` };
    }

    // Load active employees
    const employees = await prisma.employee.findMany({
      where: {
        organisationId: orgId,
        isActive: true,
        deletedAt: null,
        ...(data.propertyId ? { propertyId: data.propertyId } : {}),
      },
    });

    if (employees.length === 0) {
      return {
        ok: false,
        error: "No active employees found. Go to the Employees tab and add your team members before creating a payroll run.",
      };
    }

    // Build entries with auto-calculated UIF
    const entries = employees.map((emp) => {
      const gross = Number(emp.grossSalary);
      const uif = calcUIF(gross);
      const net = calcNet(gross, 0, 0, 0, uif, 0);
      return { employeeId: emp.id, grossPay: gross, overtime: 0, bonus: 0, otherAdditions: 0, paye: 0, uifEmployee: uif, uifEmployer: uif, otherDeductions: 0, netPay: net };
    });

    const totalGross = parseFloat(entries.reduce((s, e) => s + e.grossPay, 0).toFixed(2));
    const totalUifEmployee = parseFloat(entries.reduce((s, e) => s + e.uifEmployee, 0).toFixed(2));
    const totalUifEmployer = parseFloat(entries.reduce((s, e) => s + e.uifEmployer, 0).toFixed(2));
    const totalNet = parseFloat(entries.reduce((s, e) => s + e.netPay, 0).toFixed(2));
    const totalEmployerCost = parseFloat((totalGross + totalUifEmployer).toFixed(2));

    const run = await prisma.payrollRun.create({
      data: {
        organisationId: orgId,
        periodMonth: data.periodMonth,
        periodYear: data.periodYear,
        propertyId: data.propertyId || null,
        totalGross, totalUifEmployee, totalUifEmployer, totalNet, totalEmployerCost,
        entries: { create: entries },
      },
    });

    revalidatePath("/payroll");
    return { ok: true, data: { id: run.id } };
  } catch (e: any) {
    console.error("createPayrollRun error:", e);
    return { ok: false, error: "Failed to create payroll run. Please try again." };
  }
}

export async function updatePayrollEntry(entryId: string, data: {
  overtime?: number;
  bonus?: number;
  otherAdditions?: number;
  otherDeductions?: number;
  notes?: string;
}): Promise<ActionResult> {
  try {
    const orgId = await getOrgId();
    if (!orgId) return { ok: false, error: "Not authenticated" };

    const entry = await prisma.payrollEntry.findFirst({
      where: { id: entryId, payrollRun: { organisationId: orgId, status: "DRAFT" } },
    });
    if (!entry) return { ok: false, error: "Entry not found or payroll run is already approved." };

    const gross = Number(entry.grossPay);
    const overtime = data.overtime ?? Number(entry.overtime);
    const bonus = data.bonus ?? Number(entry.bonus);
    const otherAdditions = data.otherAdditions ?? Number(entry.otherAdditions);
    const otherDeductions = data.otherDeductions ?? Number(entry.otherDeductions);

    if (overtime < 0 || bonus < 0 || otherAdditions < 0 || otherDeductions < 0)
      return { ok: false, error: "Values cannot be negative" };

    const totalGross = gross + overtime + bonus + otherAdditions;
    const uif = calcUIF(totalGross);
    const net = calcNet(gross, overtime, bonus, otherAdditions, uif, otherDeductions);

    await prisma.payrollEntry.update({
      where: { id: entryId },
      data: { overtime, bonus, otherAdditions, otherDeductions, uifEmployee: uif, uifEmployer: uif, netPay: net, notes: data.notes ?? entry.notes },
    });

    await recalcRunTotals(entry.payrollRunId);
    revalidatePath("/payroll");
    return { ok: true, data: undefined };
  } catch (e: any) {
    console.error("updatePayrollEntry error:", e);
    return { ok: false, error: "Failed to update entry." };
  }
}

async function recalcRunTotals(runId: string) {
  const entries = await prisma.payrollEntry.findMany({ where: { payrollRunId: runId } });
  const totalGross = parseFloat(entries.reduce((s, e) => s + Number(e.grossPay) + Number(e.overtime) + Number(e.bonus) + Number(e.otherAdditions), 0).toFixed(2));
  const totalUifEmployee = parseFloat(entries.reduce((s, e) => s + Number(e.uifEmployee), 0).toFixed(2));
  const totalUifEmployer = parseFloat(entries.reduce((s, e) => s + Number(e.uifEmployer), 0).toFixed(2));
  const totalNet = parseFloat(entries.reduce((s, e) => s + Number(e.netPay), 0).toFixed(2));
  await prisma.payrollRun.update({
    where: { id: runId },
    data: { totalGross, totalUifEmployee, totalUifEmployer, totalNet, totalEmployerCost: parseFloat((totalGross + totalUifEmployer).toFixed(2)) },
  });
}

export async function approvePayrollRun(id: string): Promise<ActionResult> {
  try {
    const orgId = await getOrgId();
    if (!orgId) return { ok: false, error: "Not authenticated" };
    const run = await prisma.payrollRun.findFirst({ where: { id, organisationId: orgId, status: "DRAFT" } });
    if (!run) return { ok: false, error: "Run not found or already approved." };
    await prisma.payrollRun.update({ where: { id }, data: { status: "APPROVED" } });
    revalidatePath("/payroll");
    return { ok: true, data: undefined };
  } catch (e: any) {
    return { ok: false, error: "Failed to approve payroll run." };
  }
}

export async function markPayrollPaid(id: string, propertyId: string): Promise<ActionResult> {
  try {
    const orgId = await getOrgId();
    if (!orgId) return { ok: false, error: "Not authenticated" };
    if (!propertyId) return { ok: false, error: "A property must be selected to post payroll expenses." };

    const run = await prisma.payrollRun.findFirst({
      where: { id, organisationId: orgId, status: "APPROVED" },
      include: { entries: { include: { employee: { select: { name: true } } } } },
    });
    if (!run) return { ok: false, error: "Run not found or not yet approved." };

    const monthName = new Date(run.periodYear, run.periodMonth - 1).toLocaleString("en-ZA", { month: "long" });

    await prisma.$transaction(async (tx) => {
      await tx.payrollRun.update({ where: { id }, data: { status: "PAID", paidAt: new Date() } });

      await tx.transaction.create({
        data: {
          organisationId: orgId,
          propertyId,
          type: TransactionType.EXPENSE,
          category: TransactionCategory.SALARIES,
          source: TransactionSource.MANUAL,
          status: TransactionStatus.CLEARED,
          amount: run.totalNet,
          description: `Payroll — ${monthName} ${run.periodYear} (${run.entries.length} employees)`,
          date: new Date(),
          reference: `PAYROLL-${run.periodYear}-${String(run.periodMonth).padStart(2, "0")}`,
        },
      });

      if (Number(run.totalUifEmployer) > 0) {
        await tx.transaction.create({
          data: {
            organisationId: orgId,
            propertyId,
            type: TransactionType.EXPENSE,
            category: TransactionCategory.SALARIES,
            source: TransactionSource.MANUAL,
            status: TransactionStatus.CLEARED,
            amount: run.totalUifEmployer,
            description: `UIF (Employer contribution) — ${monthName} ${run.periodYear}`,
            date: new Date(),
            reference: `UIF-${run.periodYear}-${String(run.periodMonth).padStart(2, "0")}`,
          },
        });
      }
    });

    revalidatePath("/payroll");
    revalidatePath("/transactions");
    revalidatePath("/dashboard");
    return { ok: true, data: undefined };
  } catch (e: any) {
    console.error("markPayrollPaid error:", e);
    return { ok: false, error: "Failed to mark payroll as paid. Please try again." };
  }
}
