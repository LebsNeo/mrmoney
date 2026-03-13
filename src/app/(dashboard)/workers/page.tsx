import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireFinanceAccess } from "@/lib/finance-guard";
import { PageHeader } from "@/components/PageHeader";
import { WorkersClient } from "./WorkersClient";

function serialize<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_key, value) => {
    if (value !== null && typeof value === "object" && typeof value.toFixed === "function") return Number(value);
    if (value instanceof Date) return value.toISOString();
    return value;
  }));
}

export default async function WorkersPage() {
  await requireFinanceAccess("/workers");

  const session = await getServerSession(authOptions);
  const organisationId = (session?.user as { organisationId?: string } | undefined)?.organisationId;

  if (!organisationId) {
    return (
      <div>
        <PageHeader title="Workers" description="No organisation found." />
      </div>
    );
  }

  const today = new Date();
  const startOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));

  const [employees, tipTotals, savingsGoals] = await Promise.all([
    prisma.employee.findMany({
      where: { organisationId, deletedAt: null, isActive: true },
      include: {
        property: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.tipEntry.groupBy({
      by: ["employeeId"],
      where: {
        organisationId,
        deletedAt: null,
        tipDate: { gte: startOfMonth, lt: nextMonth },
      },
      _sum: { amount: true },
    }),
    prisma.workerSavingsGoal.groupBy({
      by: ["employeeId"],
      where: {
        organisationId,
        isActive: true,
      },
      _count: { employeeId: true },
    }),
  ]);

  const tipsByEmployee = new Map(tipTotals.map((row) => [row.employeeId, Number(row._sum.amount ?? 0)]));
  const goalsByEmployee = new Map(savingsGoals.map((row) => [row.employeeId, row._count.employeeId]));

  const workerRows = employees.map((employee) => ({
    id: employee.id,
    name: employee.name,
    propertyName: employee.property?.name ?? "All Properties",
    whatsappNumber: employee.whatsappNumber,
    whatsappOptIn: employee.whatsappOptIn,
    telegramChatId: employee.telegramChatId,
    telegramOptIn: employee.telegramOptIn,
    tipsThisMonth: tipsByEmployee.get(employee.id) ?? 0,
    activeSavingsGoals: goalsByEmployee.get(employee.id) ?? 0,
  }));

  return (
    <div>
      <PageHeader
        title="Workers"
        description="Manage worker WhatsApp consent, test payslips, and monthly tip visibility."
      />
      <WorkersClient workers={serialize(workerRows)} />
    </div>
  );
}
