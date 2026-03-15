"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type ActionResult = { ok: true } | { ok: false; error: string };

type SessionUser = { organisationId?: string };

async function getOrgId() {
  const session = await getServerSession(authOptions);
  return (session?.user as SessionUser | undefined)?.organisationId ?? null;
}

function getMonthPeriod(date: Date) {
  return {
    periodMonth: date.getUTCMonth() + 1,
    periodYear: date.getUTCFullYear(),
  };
}

function calcUIF(gross: number) {
  return parseFloat((Math.min(gross, 17712) * 0.01).toFixed(2));
}

async function recalcRunTotals(runId: string, client: Prisma.TransactionClient | typeof prisma = prisma) {
  const entries = await client.payrollEntry.findMany({ where: { payrollRunId: runId } });
  const totalGross = parseFloat(entries.reduce((sum, entry) => {
    return sum + Number(entry.grossPay) + Number(entry.overtime) + Number(entry.bonus) + Number(entry.otherAdditions);
  }, 0).toFixed(2));
  const totalUifEmployee = parseFloat(entries.reduce((sum, entry) => sum + Number(entry.uifEmployee), 0).toFixed(2));
  const totalUifEmployer = parseFloat(entries.reduce((sum, entry) => sum + Number(entry.uifEmployer), 0).toFixed(2));
  const totalNet = parseFloat(entries.reduce((sum, entry) => sum + Number(entry.netPay), 0).toFixed(2));

  await client.payrollRun.update({
    where: { id: runId },
    data: {
      totalGross,
      totalUifEmployee,
      totalUifEmployer,
      totalNet,
      totalEmployerCost: parseFloat((totalGross + totalUifEmployer).toFixed(2)),
    },
  });
}

export async function updateWorkerWhatsApp(input: {
  employeeId: string;
  whatsappNumber?: string;
  whatsappOptIn?: boolean;
}): Promise<ActionResult> {
  try {
    const organisationId = await getOrgId();
    if (!organisationId) return { ok: false, error: "Not authenticated" };

    const employee = await prisma.employee.findFirst({
      where: { id: input.employeeId, organisationId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) return { ok: false, error: "Employee not found." };

    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        ...(input.whatsappNumber !== undefined ? { whatsappNumber: input.whatsappNumber.trim() || null } : {}),
        ...(input.whatsappOptIn !== undefined ? { whatsappOptIn: input.whatsappOptIn } : {}),
      },
    });

    revalidatePath("/workers");
    revalidatePath("/payroll");
    return { ok: true };
  } catch (error) {
    console.error("updateWorkerWhatsApp error:", error);
    return { ok: false, error: "Failed to update worker WhatsApp details." };
  }
}

export async function recordBookingTip(input: {
  bookingId: string;
  employeeId: string;
  amount: number;
  source?: string;
  notes?: string;
  tipDate?: string;
}): Promise<ActionResult> {
  try {
    const organisationId = await getOrgId();
    if (!organisationId) return { ok: false, error: "Not authenticated" };
    if (!input.amount || input.amount <= 0) return { ok: false, error: "Tip amount must be greater than zero." };

    const booking = await prisma.booking.findFirst({
      where: {
        id: input.bookingId,
        deletedAt: null,
        property: { organisationId },
      },
      select: {
        id: true,
        propertyId: true,
      },
    });
    if (!booking) return { ok: false, error: "Booking not found." };

    const employee = await prisma.employee.findFirst({
      where: {
        id: input.employeeId,
        organisationId,
        deletedAt: null,
        isActive: true,
      },
      select: { id: true },
    });
    if (!employee) return { ok: false, error: "Employee not found." };

    const tipDate = input.tipDate ? new Date(`${input.tipDate}T00:00:00.000Z`) : new Date();
    const { periodMonth, periodYear } = getMonthPeriod(tipDate);

    await prisma.$transaction(async (tx) => {
      await tx.tipEntry.create({
        data: {
          organisationId,
          bookingId: booking.id,
          propertyId: booking.propertyId,
          employeeId: employee.id,
          amount: input.amount,
          tipDate,
          source: input.source?.trim() || null,
          notes: input.notes?.trim() || null,
        },
      });

      const specificRun = await tx.payrollRun.findFirst({
        where: {
          organisationId,
          propertyId: booking.propertyId,
          periodMonth,
          periodYear,
          status: "DRAFT",
          entries: { some: { employeeId: employee.id } },
        },
        select: { id: true },
      });

      const run = specificRun ?? await tx.payrollRun.findFirst({
        where: {
          organisationId,
          propertyId: null,
          periodMonth,
          periodYear,
          status: "DRAFT",
          entries: { some: { employeeId: employee.id } },
        },
        select: { id: true },
      });

      if (!run) return;

      const entry = await tx.payrollEntry.findFirst({
        where: { payrollRunId: run.id, employeeId: employee.id },
        select: {
          id: true,
          grossPay: true,
          overtime: true,
          bonus: true,
          otherAdditions: true,
          otherDeductions: true,
        },
      });

      if (!entry) return;

      const updatedOtherAdditions = parseFloat((Number(entry.otherAdditions) + input.amount).toFixed(2));
      const totalGross = Number(entry.grossPay) + Number(entry.overtime) + Number(entry.bonus) + updatedOtherAdditions;
      const uif = calcUIF(totalGross);
      const netPay = parseFloat((totalGross - uif - Number(entry.otherDeductions)).toFixed(2));

      await tx.payrollEntry.update({
        where: { id: entry.id },
        data: {
          otherAdditions: updatedOtherAdditions,
          uifEmployee: uif,
          uifEmployer: uif,
          netPay,
        },
      });

      await recalcRunTotals(run.id, tx);
    });

    revalidatePath(`/bookings/${input.bookingId}`);
    revalidatePath("/workers");
    revalidatePath("/payroll");
    return { ok: true };
  } catch (error) {
    console.error("recordBookingTip error:", error);
    return { ok: false, error: "Failed to record tip." };
  }
}

export async function createStokvel(input: {
  name: string;
  monthlyAmount: number;
  payoutMonth?: number;
  description?: string;
}): Promise<ActionResult> {
  try {
    const organisationId = await getOrgId();
    if (!organisationId) return { ok: false, error: "Not authenticated" };
    if (!input.name.trim()) return { ok: false, error: "Stokvel name is required." };
    if (!input.monthlyAmount || input.monthlyAmount <= 0) return { ok: false, error: "Monthly amount must be greater than zero." };

    await prisma.stokvel.create({
      data: {
        organisationId,
        name: input.name.trim(),
        monthlyAmount: input.monthlyAmount,
        payoutMonth: input.payoutMonth ?? null,
        description: input.description?.trim() || null,
        type: (input as any).type ?? "SAVINGS",
        autoDeduct: (input as any).autoDeduct ?? false,
        meetingDay: (input as any).meetingDay ?? null,
        meetingTime: (input as any).meetingTime ?? null,
      },
    });

    revalidatePath("/workers/stokvels");
    return { ok: true };
  } catch (error) {
    console.error("createStokvel error:", error);
    return { ok: false, error: "Failed to create stokvel." };
  }
}

export async function addStokvelMember(stokvelId: string, employeeId: string): Promise<ActionResult> {
  try {
    const organisationId = await getOrgId();
    if (!organisationId) return { ok: false, error: "Not authenticated" };

    const stokvel = await prisma.stokvel.findFirst({
      where: { id: stokvelId, organisationId, isActive: true },
      select: { id: true },
    });
    if (!stokvel) return { ok: false, error: "Stokvel not found." };

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, organisationId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!employee) return { ok: false, error: "Employee not found." };

    const existing = await prisma.stokvelMember.findFirst({
      where: { stokvelId, employeeId },
      select: { id: true, isActive: true },
    });

    if (existing?.isActive) {
      return { ok: false, error: "Employee is already a member." };
    }

    if (existing) {
      await prisma.stokvelMember.update({
        where: { id: existing.id },
        data: { isActive: true, joinedAt: new Date() },
      });
    } else {
      await prisma.stokvelMember.create({
        data: {
          stokvelId,
          employeeId,
        },
      });
    }

    revalidatePath("/workers/stokvels");
    return { ok: true };
  } catch (error) {
    console.error("addStokvelMember error:", error);
    return { ok: false, error: "Failed to add member." };
  }
}

export async function removeStokvelMember(stokvelId: string, employeeId: string): Promise<ActionResult> {
  try {
    const organisationId = await getOrgId();
    if (!organisationId) return { ok: false, error: "Not authenticated" };

    const member = await prisma.stokvelMember.findFirst({
      where: {
        stokvelId,
        employeeId,
        stokvel: { organisationId },
        isActive: true,
      },
      select: { id: true },
    });
    if (!member) return { ok: false, error: "Active member not found." };

    await prisma.stokvelMember.update({
      where: { id: member.id },
      data: { isActive: false },
    });

    revalidatePath("/workers/stokvels");
    return { ok: true };
  } catch (error) {
    console.error("removeStokvelMember error:", error);
    return { ok: false, error: "Failed to remove member." };
  }
}

export async function recordStokvelContribution(input: {
  stokvelId: string;
  employeeId: string;
  amount: number;
  period: string;
  paidAt?: string;
}): Promise<ActionResult> {
  try {
    const organisationId = await getOrgId();
    if (!organisationId) return { ok: false, error: "Not authenticated" };
    if (!input.amount || input.amount <= 0) return { ok: false, error: "Contribution amount must be greater than zero." };
    if (!input.period.trim()) return { ok: false, error: "Contribution period is required." };

    const stokvel = await prisma.stokvel.findFirst({
      where: { id: input.stokvelId, organisationId, isActive: true },
      select: { id: true },
    });
    if (!stokvel) return { ok: false, error: "Stokvel not found." };

    const member = await prisma.stokvelMember.findFirst({
      where: {
        stokvelId: input.stokvelId,
        employeeId: input.employeeId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!member) return { ok: false, error: "Employee is not an active member of this stokvel." };

    await prisma.$transaction(async (tx) => {
      await tx.stokvelContribution.create({
        data: {
          stokvelId: input.stokvelId,
          employeeId: input.employeeId,
          amount: input.amount,
          period: input.period.trim(),
          paidAt: input.paidAt ? new Date(`${input.paidAt}T00:00:00.000Z`) : null,
        },
      });

      await tx.stokvel.update({
        where: { id: input.stokvelId },
        data: {
          totalBalance: {
            increment: input.amount,
          },
        },
      });
    });

    revalidatePath("/workers/stokvels");
    return { ok: true };
  } catch (error) {
    console.error("recordStokvelContribution error:", error);
    return { ok: false, error: "Failed to record contribution." };
  }
}
