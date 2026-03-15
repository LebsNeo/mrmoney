import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireFinanceAccess } from "@/lib/finance-guard";
import { PageHeader } from "@/components/PageHeader";
import { StokvelsClient } from "./StokvelsClient";
import type { ComponentProps } from "react";

function serialize<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_key, value) => {
    if (value !== null && typeof value === "object" && typeof value.toFixed === "function") return Number(value);
    if (value instanceof Date) return value.toISOString();
    return value;
  }));
}

export default async function StokvelsPage() {
  await requireFinanceAccess("/workers/stokvels");

  const session = await getServerSession(authOptions);
  const organisationId = (session?.user as { organisationId?: string } | undefined)?.organisationId;

  if (!organisationId) {
    return (
      <div>
        <PageHeader title="Stokvels" description="No organisation found." />
      </div>
    );
  }

  const [employees, stokvels] = await Promise.all([
    prisma.employee.findMany({
      where: { organisationId, deletedAt: null, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.stokvel.findMany({
      where: { organisationId },
      include: {
        members: {
          where: { isActive: true },
          include: {
            employee: { select: { id: true, name: true } },
          },
          orderBy: { joinedAt: "asc" },
        },
        contributions: {
          include: {
            employee: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Stokvels"
        description="Create worker savings circles, manage members, and record monthly contributions."
      />
      <StokvelsClient
        employees={serialize(employees)}
        stokvels={serialize(stokvels) as unknown as ComponentProps<typeof StokvelsClient>["stokvels"]}
      />
    </div>
  );
}
