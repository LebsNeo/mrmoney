/**
 * MrMoney — iCal Sync Engine
 * Fetches iCal feeds, parses bookings, upserts into DB (dedup by externalRef/UID).
 */

import { prisma } from "@/lib/prisma";
import { parseICalFeed } from "@/lib/ical-parser";
import { logger } from "@/lib/logger";
import { OTAPlatform } from "@prisma/client";

const OTA_COMMISSION: Record<string, number> = {
  BOOKING_COM: 0.15,
  AIRBNB: 0.0345,
  LEKKERSLAAP: 0.1725,
  EXPEDIA: 0.15,
  DIRECT: 0,
};

export interface SyncResult {
  feedId: string;
  feedName: string;
  platform: string;
  created: number;
  updated: number;
  skipped: number;
  error: string | null;
}

export async function syncICalFeed(feedId: string): Promise<SyncResult> {
  const feed = await prisma.iCalFeed.findUnique({
    where: { id: feedId },
    include: { property: true, room: true },
  });

  if (!feed) return { feedId, feedName: "", platform: "", created: 0, updated: 0, skipped: 0, error: "Feed not found" };

  const result: SyncResult = {
    feedId,
    feedName: feed.feedName,
    platform: feed.platform,
    created: 0,
    updated: 0,
    skipped: 0,
    error: null,
  };

  try {
    const res = await fetch(feed.icalUrl, {
      headers: { "User-Agent": "MrMoney/1.0 iCal Sync" },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const raw = await res.text();
    const events = parseICalFeed(raw, feed.platform as any);

    // Get room — if feed has no roomId, find first room for property
    let roomId = feed.roomId;
    if (!roomId) {
      const firstRoom = await prisma.room.findFirst({
        where: { propertyId: feed.propertyId, status: "ACTIVE", deletedAt: null },
        select: { id: true, baseRate: true },
      });
      if (!firstRoom) throw new Error("No active room found for property");
      roomId = firstRoom.id;
    }

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { baseRate: true },
    });

    const baseRate = parseFloat((room?.baseRate ?? 550).toString());
    const commissionRate = OTA_COMMISSION[feed.platform] ?? 0;

    for (const event of events) {
      const externalRef = `${feed.platform}::${event.uid}`;
      const nights = Math.round(
        (event.checkOut.getTime() - event.checkIn.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (nights <= 0) { result.skipped++; continue; }

      const grossAmount = baseRate * nights;
      const otaCommission = grossAmount * commissionRate;
      const netAmount = grossAmount - otaCommission;

      // Check duplicate
      const existing = await prisma.booking.findFirst({
        where: { propertyId: feed.propertyId, externalRef },
        select: { id: true, checkIn: true, checkOut: true },
      });

      const data = {
        propertyId: feed.propertyId,
        roomId,
        source: feed.platform as any,
        guestName: event.guestName ?? `${feed.platform.replace(/_/g, " ")} Guest`,
        guestEmail: event.guestEmail ?? null,
        guestPhone: event.guestPhone ?? null,
        checkIn: event.checkIn,
        checkOut: event.checkOut,
        roomRate: baseRate,
        grossAmount,
        otaCommission,
        netAmount,
        status: "CONFIRMED" as const,
        externalRef,
        notes: event.referenceCode ? `Ref: ${event.referenceCode}` : null,
      };

      if (existing) {
        // Update only if dates changed
        const sameIn = existing.checkIn.getTime() === event.checkIn.getTime();
        const sameOut = existing.checkOut.getTime() === event.checkOut.getTime();
        if (!sameIn || !sameOut) {
          await prisma.booking.update({ where: { id: existing.id }, data });
          result.updated++;
        } else {
          result.skipped++;
        }
      } else {
        await prisma.booking.create({ data });
        result.created++;
      }
    }

    await prisma.iCalFeed.update({
      where: { id: feedId },
      data: { lastSyncAt: new Date(), lastError: null },
    });

    logger.info("iCal sync complete", { ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.error = msg;
    await prisma.iCalFeed.update({
      where: { id: feedId },
      data: { lastError: msg },
    });
    logger.error("iCal sync failed", { feedId, error: msg });
  }

  return result;
}

export async function syncAllFeeds(propertyId?: string): Promise<SyncResult[]> {
  const feeds = await prisma.iCalFeed.findMany({
    where: { isActive: true, ...(propertyId ? { propertyId } : {}) },
    select: { id: true },
  });

  const results: SyncResult[] = [];
  for (const feed of feeds) {
    results.push(await syncICalFeed(feed.id));
  }
  return results;
}
