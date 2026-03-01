import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { OTAChannelsClient } from "./OTAChannelsClient";

export default async function OTAChannelsPage() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organisationId?: string })?.organisationId;

  const [configs, properties] = await Promise.all([
    orgId
      ? prisma.oTAChannelConfig.findMany({
          where: { organisationId: orgId, deletedAt: null },
          include: { property: { select: { id: true, name: true } } },
          orderBy: [{ property: { name: "asc" } }, { platform: "asc" }],
        })
      : [],
    orgId
      ? prisma.property.findMany({
          where: { organisationId: orgId, deletedAt: null, isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [],
  ]);

  const serialised = configs.map((c) => ({
    ...c,
    commissionRate: parseFloat(String(c.commissionRate)),
    serviceFeeRate: parseFloat(String(c.serviceFeeRate)),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    deletedAt: c.deletedAt?.toISOString() ?? null,
  }));

  return (
    <div>
      <PageHeader
        title="OTA Channel Configuration"
        description="Set commission rates, payout models and bank description hints for each OTA per property"
      />
      <OTAChannelsClient configs={serialised} properties={properties} />
    </div>
  );
}
