import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiUnauthorized } from "@/lib/api-response";

export async function GET() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organisationId?: string })?.organisationId;
  if (!orgId) return apiUnauthorized();

  const configs = await prisma.oTAChannelConfig.findMany({
    where: { organisationId: orgId, deletedAt: null },
    include: { property: { select: { id: true, name: true } } },
    orderBy: [{ property: { name: "asc" } }, { platform: "asc" }],
  });

  const properties = await prisma.property.findMany({
    where: { organisationId: orgId, deletedAt: null, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return apiSuccess({
    configs: configs.map((c) => ({
      ...c,
      commissionRate: parseFloat(String(c.commissionRate)),
      serviceFeeRate: parseFloat(String(c.serviceFeeRate)),
    })),
    properties,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organisationId?: string })?.organisationId;
  if (!orgId) return apiUnauthorized();

  const body = await req.json();
  const { propertyId, platform, payoutModel, commissionRate, serviceFeeRate, payoutDelayDays, bankDescriptionHint } = body;

  if (!propertyId || !platform) return apiError("propertyId and platform required");

  // Upsert — one config per property+platform
  const config = await prisma.oTAChannelConfig.upsert({
    where: { propertyId_platform: { propertyId, platform } },
    update: {
      payoutModel,
      commissionRate,
      serviceFeeRate: serviceFeeRate ?? 0,
      payoutDelayDays: payoutDelayDays ?? 7,
      bankDescriptionHint: bankDescriptionHint || null,
      isActive: true,
      deletedAt: null,
    },
    create: {
      organisationId: orgId,
      propertyId,
      platform,
      payoutModel,
      commissionRate,
      serviceFeeRate: serviceFeeRate ?? 0,
      payoutDelayDays: payoutDelayDays ?? 7,
      bankDescriptionHint: bankDescriptionHint || null,
    },
  });

  return apiSuccess({
    ...config,
    commissionRate: parseFloat(String(config.commissionRate)),
    serviceFeeRate: parseFloat(String(config.serviceFeeRate)),
  });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organisationId?: string })?.organisationId;
  if (!orgId) return apiUnauthorized();

  const { id } = await req.json();
  if (!id) return apiError("id required");

  await prisma.oTAChannelConfig.updateMany({
    where: { id, organisationId: orgId },
    data: { deletedAt: new Date() },
  });

  return apiSuccess({ deleted: true });
}
