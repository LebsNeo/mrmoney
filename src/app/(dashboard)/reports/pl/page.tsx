import Link from "next/link";
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { PeriodSwitcher } from "@/components/PeriodSwitcher";
import { PLDisplay } from "./PLDisplay";
import { getPLStatement } from "@/lib/actions/reports";
import { PeriodPreset } from "@/lib/reports-utils";
import { PropertySwitcher } from "@/components/PropertySwitcher";

interface Props {
  searchParams: Promise<{
    period?: string;
    propertyId?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function PLPage({ searchParams }: Props) {
  const params = await searchParams;
  const period = (params.period ?? "this_month") as PeriodPreset;
  const propertyId = params.propertyId;

  const session = await getServerSession(authOptions);
  const orgId = (session?.user as any)?.organisationId as string | undefined;

  const properties = orgId
    ? await prisma.property.findMany({
        where: { organisationId: orgId, isActive: true, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const pl = await getPLStatement(
    period,
    propertyId,
    params.from,
    params.to
  );

  return (
    <div>
      <div className="mb-2">
        <Link href="/reports" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          ← Reports
        </Link>
      </div>

      <PageHeader
        title="Income Statement"
        description="Cash basis · All figures in ZAR"
        action={
          <PropertySwitcher
            properties={properties}
            currentPropertyId={propertyId}
          />
        }
      />

      {/* Period selector */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-6">
        <p className="text-xs text-gray-500 font-medium mb-2">Reporting Period</p>
        <Suspense fallback={null}>
          <PeriodSwitcher />
        </Suspense>
      </div>

      {/* P&L Statement */}
      <PLDisplay pl={pl} />
    </div>
  );
}
