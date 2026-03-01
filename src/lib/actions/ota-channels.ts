"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OTAPlatform } from "@prisma/client";

type SessionUser = { organisationId?: string };

async function getOrgId(): Promise<string> {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as SessionUser)?.organisationId;
  if (!orgId) throw new Error("Unauthorized");
  return orgId;
}

function serialize(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "object") {
    if ("toFixed" in (obj as object) || obj?.constructor?.name === "Decimal") {
      return parseFloat(String(obj));
    }
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) return obj.map(serialize);
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, serialize(v)])
    );
  }
  return obj;
}

// ─── List all channel configs for org ────────────────────────────────────────

export async function getOTAChannelConfigs() {
  try {
    const orgId = await getOrgId();
    const configs = await prisma.oTAChannelConfig.findMany({
      where: { organisationId: orgId, deletedAt: null },
      include: { property: { select: { id: true, name: true } } },
      orderBy: [{ property: { name: "asc" } }, { platform: "asc" }],
    });
    return { ok: true, data: serialize(configs) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ─── Create or update a channel config ───────────────────────────────────────

export async function upsertOTAChannelConfig(input: {
  id?: string;
  propertyId: string;
  platform: OTAPlatform;
  payoutModel: "PER_BOOKING" | "BATCHED" | "DIRECT_PAY";
  commissionRate: number;   // 0–1, e.g. 0.15
  serviceFeeRate: number;
  payoutDelayDays: number;
  bankDescriptionHint?: string;
}) {
  try {
    const orgId = await getOrgId();

    // Verify property belongs to org
    const property = await prisma.property.findFirst({
      where: { id: input.propertyId, organisationId: orgId, deletedAt: null },
      select: { id: true },
    });
    if (!property) return { ok: false, error: "Property not found" };

    const data = {
      organisationId: orgId,
      propertyId: input.propertyId,
      platform: input.platform,
      payoutModel: input.payoutModel,
      commissionRate: input.commissionRate,
      serviceFeeRate: input.serviceFeeRate,
      payoutDelayDays: input.payoutDelayDays,
      bankDescriptionHint: input.bankDescriptionHint ?? null,
      isActive: true,
      updatedAt: new Date(),
    };

    let config;
    if (input.id) {
      config = await prisma.oTAChannelConfig.update({
        where: { id: input.id },
        data,
      });
    } else {
      // Upsert on propertyId + platform unique constraint
      config = await prisma.oTAChannelConfig.upsert({
        where: { propertyId_platform: { propertyId: input.propertyId, platform: input.platform } },
        create: data,
        update: data,
      });
    }

    return { ok: true, data: serialize(config) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ─── Delete (soft) ────────────────────────────────────────────────────────────

export async function deleteOTAChannelConfig(id: string) {
  try {
    const orgId = await getOrgId();
    await prisma.oTAChannelConfig.updateMany({
      where: { id, organisationId: orgId },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ─── Seed default configs for a property ─────────────────────────────────────

export async function seedDefaultOTAChannels(propertyId: string) {
  try {
    const orgId = await getOrgId();

    const defaults = [
      {
        platform: "BOOKING_COM" as OTAPlatform,
        payoutModel: "BATCHED" as const,
        commissionRate: 0.15,
        serviceFeeRate: 0.021,
        payoutDelayDays: 7,
        bankDescriptionHint: "BOOKING.COM BV",
      },
      {
        platform: "AIRBNB" as OTAPlatform,
        payoutModel: "PER_BOOKING" as const,
        commissionRate: 0.0345,
        serviceFeeRate: 0,
        payoutDelayDays: 1,
        bankDescriptionHint: "NDS*AIRBNB",
      },
      {
        platform: "LEKKERSLAAP" as OTAPlatform,
        payoutModel: "BATCHED" as const,
        commissionRate: 0.15,
        serviceFeeRate: 0.0207,
        payoutDelayDays: 7,
        bankDescriptionHint: "LEKKESLAAP",
      },
    ];

    for (const d of defaults) {
      await prisma.oTAChannelConfig.upsert({
        where: { propertyId_platform: { propertyId, platform: d.platform } },
        create: { organisationId: orgId, propertyId, ...d },
        update: {},  // Don't overwrite existing configs
      });
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
