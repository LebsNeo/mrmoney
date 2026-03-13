"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  sendLatestTestPayslipForEmployee,
  sendPayrollRunPayslipsForOrg,
} from "@/lib/whatsapp/worker-payslips";

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
