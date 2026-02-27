import { Suspense } from "react";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPLStatement } from "@/lib/actions/reports";
import { PageHeader } from "@/components/PageHeader";
import { PLPeriodPicker } from "@/components/PLPeriodPicker";
import { PLStatementView } from "@/components/PLStatementView";

interface Props {
  searchParams: Promise<{ from?: string; to?: string; propertyId?: string; preset?: string }>;
}

function defaultPeriod() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const from = new Date(y, m, 1).toISOString().slice(0, 10);
  const to = new Date(y, m + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

export default async function PLPage({ searchParams }: Props) {
  const params = await searchParams;
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as any)?.organisationId as string | undefined;

  const { from, to } = params.from && params.to
    ? { from: params.from, to: params.to }
    : defaultPeriod();

  const properties = orgId ? await prisma.property.findMany({
    where: { organisationId: orgId, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  }) : [];

  const pl = await getPLStatement(from, to, params.propertyId || undefined);

  return (
    <div>
      <div className="mb-2">
        <Link href="/reports" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          ← Reports
        </Link>
      </div>
      <PageHeader
        title="Income Statement"
        description="Cash basis · Figures in ZAR"
      />

      <Suspense>
        <PLPeriodPicker
          propertyId={params.propertyId}
          properties={properties}
        />
      </Suspense>

      <PLStatementView pl={pl} />
    </div>
  );
}
