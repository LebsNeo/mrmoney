import { prisma } from "@/lib/prisma";
import { MetaProvider } from "@/lib/whatsapp/providers/meta";
import { TwilioProvider } from "@/lib/whatsapp/providers/twilio";

type SendResult =
  | { ok: true; sent: number; failed: number }
  | { ok: false; error: string; sent: number; failed: number };

function getPeriodRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

function monthLabel(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-ZA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatRand(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function normalizeWhatsAppNumber(phone: string) {
  const compact = phone.replace(/\s+/g, "");
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("0")) return `+27${compact.slice(1)}`;
  return `+${compact}`;
}

function buildPayslipMessage(input: {
  monthYear: string;
  propertyName: string;
  employeeName: string;
  basicSalary: number;
  tips: number;
  overtime: number;
  bonus: number;
  uif: number;
  otherDeductions: number;
  netPay: number;
}) {
  const lines = [
    `*MrCA Payslip - ${input.monthYear}*`,
    input.propertyName,
    "",
    `Employee: ${input.employeeName}`,
    `Period: ${input.monthYear}`,
    "",
    "*Earnings*",
    `Basic Salary: R${formatRand(input.basicSalary)}`,
    `Tips: R${formatRand(input.tips)}`,
    `Overtime: R${formatRand(input.overtime)}`,
    `Bonus: R${formatRand(input.bonus)}`,
    "",
    "*Deductions*",
    `UIF: R${formatRand(input.uif)}`,
  ];

  if (input.otherDeductions > 0) {
    lines.push(`Other Deductions: R${formatRand(input.otherDeductions)}`);
  }

  lines.push("");
  lines.push(`*NET PAY: R${formatRand(input.netPay)}*`);
  lines.push("");
  lines.push("Questions? Reply HELP");

  return lines.join("\n");
}

async function sendWhatsAppForOrganisation(organisationId: string, to: string, body: string) {
  const cleaned = normalizeWhatsAppNumber(to);

  if (process.env.TWILIO_ACCOUNT_SID) {
    await TwilioProvider.send({ to: cleaned, body });
    return;
  }

  const connection = await prisma.whatsAppConnection.findFirst({
    where: { organisationId, isActive: true },
    select: { phoneNumberId: true, accessToken: true },
  });

  if (connection) {
    const destination = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
    const res = await fetch(`https://graph.facebook.com/v19.0/${connection.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: destination,
        type: "text",
        text: { body },
      }),
    });

    if (!res.ok) {
      throw new Error(`Meta send failed: ${await res.text()}`);
    }
    return;
  }

  await MetaProvider.send({ to: cleaned, body });
}

export async function sendPayrollRunPayslipsForOrg(
  organisationId: string,
  payrollRunId: string
): Promise<SendResult> {
  const run = await prisma.payrollRun.findFirst({
    where: { id: payrollRunId, organisationId },
    include: {
      property: { select: { name: true } },
      entries: {
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              whatsappNumber: true,
              whatsappOptIn: true,
            },
          },
        },
      },
    },
  });

  if (!run) return { ok: false, error: "Payroll run not found.", sent: 0, failed: 0 };

  const optedInEntries = run.entries.filter(
    (entry) => entry.employee.whatsappNumber && entry.employee.whatsappOptIn
  );

  if (optedInEntries.length === 0) {
    return { ok: true, sent: 0, failed: 0 };
  }

  const employeeIds = optedInEntries.map((entry) => entry.employeeId);
  const { start, end } = getPeriodRange(run.periodYear, run.periodMonth);
  const monthYear = monthLabel(run.periodYear, run.periodMonth);

  const tipRows = await prisma.tipEntry.groupBy({
    by: ["employeeId"],
    where: {
      organisationId,
      employeeId: { in: employeeIds },
      deletedAt: null,
      tipDate: { gte: start, lt: end },
    },
    _sum: { amount: true },
  });

  const tipsByEmployee = new Map(
    tipRows.map((row) => [row.employeeId, Number(row._sum.amount ?? 0)])
  );

  let sent = 0;
  let failed = 0;

  for (const entry of optedInEntries) {
    try {
      const message = buildPayslipMessage({
        monthYear,
        propertyName: run.property?.name ?? "MrCA",
        employeeName: entry.employee.name,
        basicSalary: Number(entry.grossPay),
        tips: tipsByEmployee.get(entry.employeeId) ?? 0,
        overtime: Number(entry.overtime),
        bonus: Number(entry.bonus),
        uif: Number(entry.uifEmployee),
        otherDeductions: Number(entry.otherDeductions),
        netPay: Number(entry.netPay),
      });

      await sendWhatsAppForOrganisation(organisationId, entry.employee.whatsappNumber!, message);
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error("sendPayrollRunPayslipsForOrg failed:", {
        payrollRunId,
        employeeId: entry.employeeId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { ok: true, sent, failed };
}

export async function sendLatestTestPayslipForEmployee(
  organisationId: string,
  employeeId: string
): Promise<SendResult> {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, organisationId, deletedAt: null, isActive: true },
    select: {
      id: true,
      name: true,
      whatsappNumber: true,
      whatsappOptIn: true,
    },
  });

  if (!employee) return { ok: false, error: "Employee not found.", sent: 0, failed: 0 };
  if (!employee.whatsappNumber || !employee.whatsappOptIn) {
    return { ok: false, error: "Employee must have a WhatsApp number and opt in enabled.", sent: 0, failed: 0 };
  }

  const latestEntry = await prisma.payrollEntry.findFirst({
    where: {
      employeeId,
      payrollRun: { organisationId, status: "PAID" },
    },
    include: {
      payrollRun: {
        include: { property: { select: { name: true } } },
      },
    },
    orderBy: [
      { payrollRun: { periodYear: "desc" } },
      { payrollRun: { periodMonth: "desc" } },
    ],
  });

  if (!latestEntry) {
    return { ok: false, error: "No paid payroll run found for this employee.", sent: 0, failed: 0 };
  }

  const run = latestEntry.payrollRun;
  const { start, end } = getPeriodRange(run.periodYear, run.periodMonth);
  const tips = await prisma.tipEntry.aggregate({
    where: {
      organisationId,
      employeeId,
      deletedAt: null,
      tipDate: { gte: start, lt: end },
    },
    _sum: { amount: true },
  });

  try {
    const message = buildPayslipMessage({
      monthYear: monthLabel(run.periodYear, run.periodMonth),
      propertyName: run.property?.name ?? "MrCA",
      employeeName: employee.name,
      basicSalary: Number(latestEntry.grossPay),
      tips: Number(tips._sum.amount ?? 0),
      overtime: Number(latestEntry.overtime),
      bonus: Number(latestEntry.bonus),
      uif: Number(latestEntry.uifEmployee),
      otherDeductions: Number(latestEntry.otherDeductions),
      netPay: Number(latestEntry.netPay),
    });

    await sendWhatsAppForOrganisation(organisationId, employee.whatsappNumber, message);
    return { ok: true, sent: 1, failed: 0 };
  } catch (error) {
    console.error("sendLatestTestPayslipForEmployee failed:", {
      employeeId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: true, sent: 0, failed: 1 };
  }
}
