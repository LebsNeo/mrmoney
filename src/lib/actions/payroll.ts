"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { TransactionCategory, TransactionType, TransactionStatus, TransactionSource } from "@prisma/client";

// ─── UIF constants (2025) ─────────────────────────────────────────────────
const UIF_RATE = 0.01;           // 1% each side
const UIF_CAP = 17712;           // Monthly remuneration cap (R17,712)

function calcUIF(gross: number): number {
  return Math.min(gross, UIF_CAP) * UIF_RATE;
}

function calcNetPay(gross: number, overtime: number, bonus: number, otherAdditions: number, paye: number, uifEmployee: number, otherDeductions: number): number {
  const totalGross = gross + overtime + bonus + otherAdditions;
  return totalGross - paye - uifEmployee - otherDeductions;
}

async function getOrgId(): Promise<string> {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organisationId?: string })?.organisationId;
  if (!orgId) throw new Error("Unauthorised");
  return orgId;
}

// ─── EMPLOYEES ────────────────────────────────────────────────────────────

export async function getEmployees(propertyId?: string) {
  const orgId = await getOrgId();
  return prisma.employee.findMany({
    where: {
      organisationId: orgId,
      isActive: true,
      deletedAt: null,
      ...(propertyId ? { propertyId } : {}),
    },
    include: { property: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
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
}) {
  const orgId = await getOrgId();
  const employee = await prisma.employee.create({
    data: {
      organisationId: orgId,
      name: data.name,
      employmentType: data.employmentType,
      jobTitle: data.jobTitle ?? null,
      grossSalary: data.grossSalary,
      startDate: new Date(data.startDate),
      propertyId: data.propertyId ?? null,
      idNumber: data.idNumber ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      bankName: data.bankName ?? null,
      bankAccount: data.bankAccount ?? null,
      bankBranch: data.bankBranch ?? null,
      notes: data.notes ?? null,
    },
  });
  revalidatePath("/payroll");
  return employee;
}

export async function updateEmployee(id: string, data: Partial<{
  name: string;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT";
  jobTitle: string;
  grossSalary: number;
  startDate: string;
  propertyId: string;
  idNumber: string;
  email: string;
  phone: string;
  bankName: string;
  bankAccount: string;
  bankBranch: string;
  isActive: boolean;
  notes: string;
}>) {
  const orgId = await getOrgId();
  const employee = await prisma.employee.update({
    where: { id, organisationId: orgId },
    data: {
      ...data,
      ...(data.startDate ? { startDate: new Date(data.startDate) } : {}),
      ...(data.grossSalary !== undefined ? { grossSalary: data.grossSalary } : {}),
    },
  });
  revalidatePath("/payroll");
  return employee;
}

export async function deleteEmployee(id: string) {
  const orgId = await getOrgId();
  await prisma.employee.update({
    where: { id, organisationId: orgId },
    data: { isActive: false, deletedAt: new Date() },
  });
  revalidatePath("/payroll");
}

// ─── PAYROLL RUNS ─────────────────────────────────────────────────────────

export async function getPayrollRuns() {
  const orgId = await getOrgId();
  return prisma.payrollRun.findMany({
    where: { organisationId: orgId },
    include: {
      entries: { include: { employee: { select: { name: true, employmentType: true } } } },
      property: { select: { name: true } },
    },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
  });
}

export async function getPayrollRun(id: string) {
  const orgId = await getOrgId();
  return prisma.payrollRun.findFirst({
    where: { id, organisationId: orgId },
    include: {
      entries: {
        include: {
          employee: {
            select: { name: true, jobTitle: true, employmentType: true, bankName: true, bankAccount: true, idNumber: true },
          },
        },
        orderBy: { employee: { name: "asc" } },
      },
      property: { select: { name: true } },
    },
  });
}

export async function createPayrollRun(data: {
  periodMonth: number;
  periodYear: number;
  propertyId?: string;
}) {
  const orgId = await getOrgId();

  // Check for duplicate
  const existing = await prisma.payrollRun.findFirst({
    where: {
      organisationId: orgId,
      periodMonth: data.periodMonth,
      periodYear: data.periodYear,
      ...(data.propertyId ? { propertyId: data.propertyId } : { propertyId: null }),
    },
  });
  if (existing) throw new Error(`Payroll run for ${data.periodMonth}/${data.periodYear} already exists`);

  // Load active employees
  const employees = await prisma.employee.findMany({
    where: {
      organisationId: orgId,
      isActive: true,
      deletedAt: null,
      ...(data.propertyId ? { propertyId: data.propertyId } : {}),
    },
  });

  if (employees.length === 0) throw new Error("No active employees found. Add employees first.");

  // Build entries with auto-calculated UIF
  const entries = employees.map((emp) => {
    const gross = Number(emp.grossSalary);
    const uif = calcUIF(gross);
    const net = calcNetPay(gross, 0, 0, 0, 0, uif, 0);
    return {
      employeeId: emp.id,
      grossPay: gross,
      overtime: 0,
      bonus: 0,
      otherAdditions: 0,
      paye: 0,
      uifEmployee: uif,
      uifEmployer: uif,
      otherDeductions: 0,
      netPay: net,
    };
  });

  const totalGross = entries.reduce((s, e) => s + e.grossPay, 0);
  const totalUifEmployee = entries.reduce((s, e) => s + e.uifEmployee, 0);
  const totalUifEmployer = entries.reduce((s, e) => s + e.uifEmployer, 0);
  const totalNet = entries.reduce((s, e) => s + e.netPay, 0);
  const totalEmployerCost = totalGross + totalUifEmployer;

  const run = await prisma.payrollRun.create({
    data: {
      organisationId: orgId,
      periodMonth: data.periodMonth,
      periodYear: data.periodYear,
      propertyId: data.propertyId ?? null,
      totalGross,
      totalUifEmployee,
      totalUifEmployer,
      totalNet,
      totalEmployerCost,
      entries: { create: entries },
    },
    include: {
      entries: { include: { employee: { select: { name: true } } } },
    },
  });

  revalidatePath("/payroll");
  return run;
}

export async function updatePayrollEntry(entryId: string, data: {
  overtime?: number;
  bonus?: number;
  otherAdditions?: number;
  otherDeductions?: number;
  notes?: string;
}) {
  const orgId = await getOrgId();

  // Verify ownership via payroll run
  const entry = await prisma.payrollEntry.findFirst({
    where: { id: entryId, payrollRun: { organisationId: orgId } },
    include: { employee: true },
  });
  if (!entry) throw new Error("Entry not found");

  const gross = Number(entry.grossPay);
  const overtime = data.overtime ?? Number(entry.overtime);
  const bonus = data.bonus ?? Number(entry.bonus);
  const otherAdditions = data.otherAdditions ?? Number(entry.otherAdditions);
  const otherDeductions = data.otherDeductions ?? Number(entry.otherDeductions);
  const totalGross = gross + overtime + bonus + otherAdditions;
  const uif = calcUIF(totalGross);
  const net = calcNetPay(gross, overtime, bonus, otherAdditions, 0, uif, otherDeductions);

  const updated = await prisma.payrollEntry.update({
    where: { id: entryId },
    data: {
      overtime,
      bonus,
      otherAdditions,
      otherDeductions,
      uifEmployee: uif,
      uifEmployer: uif,
      netPay: net,
      notes: data.notes ?? entry.notes,
    },
  });

  // Recalculate run totals
  await recalcRunTotals(entry.payrollRunId);
  revalidatePath("/payroll");
  return updated;
}

async function recalcRunTotals(runId: string) {
  const entries = await prisma.payrollEntry.findMany({ where: { payrollRunId: runId } });
  const totalGross = entries.reduce((s, e) => s + Number(e.grossPay) + Number(e.overtime) + Number(e.bonus) + Number(e.otherAdditions), 0);
  const totalUifEmployee = entries.reduce((s, e) => s + Number(e.uifEmployee), 0);
  const totalUifEmployer = entries.reduce((s, e) => s + Number(e.uifEmployer), 0);
  const totalNet = entries.reduce((s, e) => s + Number(e.netPay), 0);
  await prisma.payrollRun.update({
    where: { id: runId },
    data: { totalGross, totalUifEmployee, totalUifEmployer, totalNet, totalEmployerCost: totalGross + totalUifEmployer },
  });
}

export async function approvePayrollRun(id: string) {
  const orgId = await getOrgId();
  const run = await prisma.payrollRun.update({
    where: { id, organisationId: orgId },
    data: { status: "APPROVED" },
  });
  revalidatePath("/payroll");
  return run;
}

export async function markPayrollPaid(id: string, propertyId: string) {
  const orgId = await getOrgId();
  const run = await prisma.payrollRun.findFirst({
    where: { id, organisationId: orgId, status: "APPROVED" },
    include: { entries: { include: { employee: { select: { name: true } } } } },
  });
  if (!run) throw new Error("Run not found or not approved");

  const monthName = new Date(run.periodYear, run.periodMonth - 1).toLocaleString("en-ZA", { month: "long" });

  // Post wages as a single EXPENSE transaction
  await prisma.$transaction(async (tx) => {
    await tx.payrollRun.update({
      where: { id },
      data: { status: "PAID", paidAt: new Date() },
    });

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

    // Also post employer UIF as separate expense
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
          description: `UIF (Employer) — ${monthName} ${run.periodYear}`,
          date: new Date(),
          reference: `UIF-${run.periodYear}-${String(run.periodMonth).padStart(2, "0")}`,
        },
      });
    }
  });

  revalidatePath("/payroll");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}
