import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getChannelMix, getRoomOccupancy, getMonthlyTrend, getIntelligenceSummary } from "@/lib/actions/intelligence";
import { IntelligenceClient } from "./IntelligenceClient";

interface PageProps {
  searchParams: Promise<{ propertyId?: string }>;
}

export default async function IntelligencePage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organisationId?: string })?.organisationId;
  const params = await searchParams;

  const properties = orgId
    ? await prisma.property.findMany({
        where: { organisationId: orgId, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const propertyId = params.propertyId ?? properties[0]?.id;

  const [channelRes, roomRes, trendRes, summaryRes] = await Promise.all([
    getChannelMix(propertyId, 1),
    propertyId ? getRoomOccupancy(propertyId, 1) : Promise.resolve({ ok: false as const, error: "No property" }),
    getMonthlyTrend(propertyId, 6),
    getIntelligenceSummary(propertyId),
  ]);

  return (
    <IntelligenceClient
      properties={properties}
      selectedPropertyId={propertyId ?? ""}
      channelData={channelRes.ok ? channelRes.data : null}
      roomData={roomRes.ok ? roomRes.data : null}
      trendData={trendRes.ok ? trendRes.data : []}
      summaryData={summaryRes.ok ? summaryRes.data : null}
    />
  );
}
