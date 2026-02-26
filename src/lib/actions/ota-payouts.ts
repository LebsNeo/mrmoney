"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { OTAPlatform } from "@prisma/client";
import {
  parseLekkerslaapCSV,
  parseBookingComCSV,
  saveOTAPayoutsToDb,
} from "@/lib/ota-import";

export interface OTAPayoutFilters {
  platform?: OTAPlatform;
  propertyId?: string;
  organisationId?: string;
  page?: number;
  limit?: number;
}

/** List all OTA payouts with summary */
export async function getOTAPayouts(filters: OTAPayoutFilters = {}) {
  const { platform, propertyId, organisationId, page = 1, limit = 20 } = filters;
  const skip = (page - 1) * limit;

  const where = {
    deletedAt: null,
    ...(platform && { platform }),
    ...(propertyId && { propertyId }),
    ...(organisationId && { organisationId }),
  };

  const [payouts, total] = await Promise.all([
    prisma.oTAPayout.findMany({
      where,
      include: {
        property: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { payoutDate: "desc" },
      skip,
      take: limit,
    }),
    prisma.oTAPayout.count({ where }),
  ]);

  return { payouts, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/** Get a single OTA payout with all items */
export async function getOTAPayoutById(id: string) {
  return prisma.oTAPayout.findUnique({
    where: { id },
    include: {
      property: true,
      items: {
        include: {
          booking: {
            select: {
              id: true,
              guestName: true,
              status: true,
              netAmount: true,
            },
          },
        },
        orderBy: { checkIn: "asc" },
      },
    },
  });
}

/** Platform summary for the payouts list */
export async function getPayoutPlatformSummary(organisationId?: string) {
  const platforms = Object.values(OTAPlatform);
  const results = await Promise.all(
    platforms.map(async (platform) => {
      const agg = await prisma.oTAPayout.aggregate({
        where: {
          platform,
          deletedAt: null,
          ...(organisationId && { organisationId }),
        },
        _sum: {
          grossAmount: true,
          totalCommission: true,
          netAmount: true,
        },
        _count: true,
      });
      return {
        platform,
        count: agg._count,
        grossAmount: Number(agg._sum.grossAmount ?? 0),
        totalCommission: Number(agg._sum.totalCommission ?? 0),
        netAmount: Number(agg._sum.netAmount ?? 0),
      };
    })
  );
  return results.filter((r) => r.count > 0);
}

/** Manual match: assign a booking to an unmatched payout item */
export async function matchPayoutItem(payoutItemId: string, bookingId: string) {
  try {
    await prisma.oTAPayoutItem.update({
      where: { id: payoutItemId },
      data: { bookingId, isMatched: true },
    });
    revalidatePath("/ota-payouts");
    return { success: true, message: "Matched successfully" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: msg };
  }
}

/** Import a CSV file — parse + save payouts */
export async function importOTAPayoutCSV(
  organisationId: string,
  propertyId: string,
  platform: OTAPlatform,
  csvContent: string,
  filename: string
) {
  const parseResult =
    platform === OTAPlatform.LEKKERSLAAP
      ? parseLekkerslaapCSV(csvContent)
      : parseBookingComCSV(csvContent);

  if (parseResult.bookingCount === 0 && parseResult.payouts.length === 0) {
    return {
      success: false,
      message: "No payout data found. Check the file format.",
    };
  }

  const result = await saveOTAPayoutsToDb(
    parseResult,
    propertyId,
    organisationId,
    filename
  );

  revalidatePath("/ota-payouts");
  return { success: true, ...result };
}
