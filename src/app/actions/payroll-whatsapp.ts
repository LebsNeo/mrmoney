"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  sendLatestTestPayslipForEmployee,
  sendPayrollRunPayslipsForOrg,
} from "@/lib/whatsapp/worker-payslips";
import { createEmployeeLinkToken, buildEmployeeLinkUrl } from "@/lib/telegram/employee-bot";
import { prisma } from "@/lib/prisma";

type SessionUser = { organisationId?: string };

async function getOrgId() {
  const session = await getServerSession(authOptions);
  return (session?.user as SessionUser | undefined)?.organisationId ?? null;
}

export async function sendPayrollRunPayslips(payrollRunId: string) {
  const organisationId = await getOrgId();
  if (!organisationId) {
    return { ok: false as const, error: "Not authenticated", sent: 0, failed: 0 };
  }

  return sendPayrollRunPayslipsForOrg(organisationId, payrollRunId);
}

export async function sendTestPayslip(employeeId: string) {
  const organisationId = await getOrgId();
  if (!organisationId) {
    return { ok: false as const, error: "Not authenticated", sent: 0, failed: 0 };
  }

  return sendLatestTestPayslipForEmployee(organisationId, employeeId);
}

export async function generateEmployeeTelegramLink(employeeId: string) {
  const organisationId = await getOrgId();
  if (!organisationId) return { ok: false as const, error: "Not authenticated", url: null };

  // Verify employee belongs to org
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, organisationId, deletedAt: null },
    select: { id: true, name: true, telegramChatId: true },
  });
  if (!employee) return { ok: false as const, error: "Employee not found", url: null };

  const token = await createEmployeeLinkToken(employeeId);
  const url = buildEmployeeLinkUrl(token);

  return { ok: true as const, url, employeeName: employee.name, alreadyLinked: !!employee.telegramChatId };
}

export async function unlinkEmployeeTelegram(employeeId: string) {
  const organisationId = await getOrgId();
  if (!organisationId) return { ok: false as const, error: "Not authenticated" };

  await prisma.employee.updateMany({
    where: { id: employeeId, organisationId },
    data: { telegramChatId: null, telegramOptIn: false },
  });

  return { ok: true as const };
}
