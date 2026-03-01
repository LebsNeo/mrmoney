"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { TransactionType, TransactionStatus, TransactionSource, TransactionCategory } from "@prisma/client";

type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

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

// ─── Record a new advance / loan ──────────────────────────────────────────

export async function recordAdvance(data: {
  employeeId: string;
  propertyId: string;
  type: "ADVANCE" | "LOAN";
  amount: number;
  monthlyInstalment?: number;
  givenDate: string;
  notes?: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const orgId = await getOrgId();
    if (!orgId) return { ok: false, error: "Not authenticated" };

    if (!data.employeeId) return { ok: false, error: "Employee is required" };
    if (!data.propertyId) return { ok: false, error: "Property is required to record the cash outflow" };
    if (!data.amount || data.amount <= 0) return { ok: false, error: "Amount must be greater than zero" };
    if (!data.givenDate) return { ok: false, error: "Date is required" };

    if (data.type === "LOAN") {
      if (!data.monthlyInstalment || data.monthlyInstalment <= 0)
        return { ok: false, error: "Monthly instalment is required for a loan" };
      if (data.monthlyInstalment > data.amount)
        return { ok: false, error: "Monthly instalment cannot exceed the loan amount" };
    }

    // Verify employee belongs to this org
    const employee = await prisma.employee.findFirst({
      where: { id: data.employeeId, organisationId: orgId, isActive: true },
      select: { id: true, name: true, grossSalary: true },
    });
    if (!employee) return { ok: false, error: "Employee not found" };

    // Warn if advance > monthly salary (still allow, just flag)
    const grossSalary = Number(employee.grossSalary);
    if (data.amount > grossSalary * 3) {
      return { ok: false, error: `Amount (R${data.amount.toLocaleString()}) exceeds 3× ${employee.name}'s monthly salary. Please double-check.` };
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Post immediate cash outflow — category EMPLOYEE_ADVANCE, NOT SALARIES
      const transaction = await tx.transaction.create({
        data: {
          organisationId: orgId,
          propertyId: data.propertyId,
          type: TransactionType.EXPENSE,
          category: TransactionCategory.EMPLOYEE_ADVANCE,
          source: TransactionSource.MANUAL,
          status: TransactionStatus.CLEARED,
          amount: data.amount,
          date: new Date(data.givenDate),
          description: `${data.type === "LOAN" ? "Employee Loan" : "Salary Advance"} — ${employee.name}`,
          reference: `ADV-${employee.id.slice(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
          notes: data.notes ?? null,
        },
      });

      // 2. Create advance record linked to the transaction
      const advance = await tx.employeeAdvance.create({
        data: {
          organisationId: orgId,
          employeeId: data.employeeId,
          propertyId: data.propertyId,
          type: data.type,
          amount: data.amount,
          monthlyInstalment: data.type === "LOAN" ? (data.monthlyInstalment ?? null) : null,
          remainingBalance: data.amount,
          givenDate: new Date(data.givenDate),
          notes: data.notes ?? null,
          transactionId: transaction.id,
        },
      });

      return advance;
    });

    revalidatePath("/payroll");
    revalidatePath("/transactions");
    revalidatePath("/dashboard");
    return { ok: true, data: { id: result.id } };
  } catch (e: any) {
    console.error("recordAdvance error:", e);
    return { ok: false, error: "Failed to record advance. Please try again." };
  }
}

// ─── Get active advances for org (or specific employee) ───────────────────

export async function getEmployeeAdvances(employeeId?: string) {
  const orgId = await getOrgId();
  if (!orgId) return [];
  const rows = await prisma.employeeAdvance.findMany({
    where: {
      organisationId: orgId,
      ...(employeeId ? { employeeId } : {}),
    },
    include: {
      employee: { select: { name: true, grossSalary: true } },
      repayments: { select: { amount: true, payrollRunId: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return serialize(rows);
}

// ─── Get pending advances for a payroll run (suggested deductions) ─────────

export async function getPendingAdvancesForPayroll(orgId: string, propertyId?: string) {
  const rows = await prisma.employeeAdvance.findMany({
    where: {
      organisationId: orgId,
      status: "ACTIVE",
      ...(propertyId ? { propertyId } : {}),
    },
    include: { employee: { select: { name: true } } },
  });
  return serialize(rows);
}

// ─── Settle advance repayments after payroll is paid ──────────────────────

export async function settleAdvanceRepayments(
  payrollRunId: string,
  repayments: Array<{ advanceId: string; payrollEntryId: string; amount: number }>
): Promise<ActionResult> {
  try {
    const orgId = await getOrgId();
    if (!orgId) return { ok: false, error: "Not authenticated" };

    if (repayments.length === 0) return { ok: true, data: undefined };

    await prisma.$transaction(async (tx) => {
      for (const rep of repayments) {
        if (!rep.amount || rep.amount <= 0) continue;

        // Verify advance belongs to this org
        const advance = await tx.employeeAdvance.findFirst({
          where: { id: rep.advanceId, organisationId: orgId, status: "ACTIVE" },
        });
        if (!advance) continue;

        // Record repayment
        await tx.advanceRepayment.create({
          data: {
            advanceId: rep.advanceId,
            payrollRunId,
            payrollEntryId: rep.payrollEntryId,
            amount: rep.amount,
          },
        });

        // Reduce balance
        const newBalance = Math.max(0, Number(advance.remainingBalance) - rep.amount);
        await tx.employeeAdvance.update({
          where: { id: rep.advanceId },
          data: {
            remainingBalance: newBalance,
            status: newBalance === 0 ? "SETTLED" : "ACTIVE",
            updatedAt: new Date(),
          },
        });
      }
    });

    revalidatePath("/payroll");
    return { ok: true, data: undefined };
  } catch (e: any) {
    console.error("settleAdvanceRepayments error:", e);
    return { ok: false, error: "Failed to settle advance repayments." };
  }
}

// ─── Manually settle / write off an advance ───────────────────────────────

export async function settleAdvanceManually(advanceId: string): Promise<ActionResult> {
  try {
    const orgId = await getOrgId();
    if (!orgId) return { ok: false, error: "Not authenticated" };
    await prisma.employeeAdvance.update({
      where: { id: advanceId, organisationId: orgId },
      data: { status: "SETTLED", remainingBalance: 0, updatedAt: new Date() },
    });
    revalidatePath("/payroll");
    return { ok: true, data: undefined };
  } catch (e: any) {
    return { ok: false, error: "Failed to settle advance." };
  }
}
