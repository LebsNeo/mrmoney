import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OTAClient } from "./OTAClient";

export default async function OTAPage() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organisationId?: string })?.organisationId;

  const properties = orgId
    ? await prisma.property.findMany({
        where: { organisationId: orgId, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const configs = orgId
    ? await prisma.oTAChannelConfig.findMany({
        where: { organisationId: orgId, deletedAt: null },
        include: { property: { select: { id: true, name: true } } },
        orderBy: [{ property: { name: "asc" } }, { platform: "asc" }],
      })
    : [];

  // Serialise Decimal → number
  const serialisedConfigs = configs.map(c => ({
    ...c,
    commissionRate: parseFloat(String(c.commissionRate)),
    serviceFeeRate: parseFloat(String(c.serviceFeeRate)),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    deletedAt: c.deletedAt?.toISOString() ?? null,
  }));

  return <OTAClient properties={properties} configs={serialisedConfigs} />;
}
