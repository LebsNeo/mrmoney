import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPayrollRuns, getEmployees } from "@/lib/actions/payroll";
import { PayrollClient } from "./PayrollClient";

export default async function PayrollPage() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as any)?.organisationId as string;

  const properties = orgId
    ? await prisma.property.findMany({
        where: { organisationId: orgId, isActive: true, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const [runs, employees] = await Promise.all([
    getPayrollRuns(),
    getEmployees(),
  ]);

  return <PayrollClient runs={runs} employees={employees} properties={properties} />;
}
