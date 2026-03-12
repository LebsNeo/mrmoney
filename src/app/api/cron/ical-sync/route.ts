import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncICalFeed, SyncResult } from "@/lib/ical-sync";

export const maxDuration = 60;

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev mode — no secret set
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all active feeds across all orgs
  const feeds = await prisma.iCalFeed.findMany({
    where: { isActive: true },
    select: { id: true, feedName: true, platform: true, propertyId: true },
    orderBy: { platform: "asc" },
  });

  if (feeds.length === 0) {
    return NextResponse.json({ ok: true, synced: 0, message: "No active iCal feeds" });
  }

  const results: SyncResult[] = [];
  const errors: { feed: string; error: string }[] = [];

  for (const feed of feeds) {
    const result = await syncICalFeed(feed.id);
    results.push(result);
    if (result.error) {
      errors.push({ feed: feed.feedName, error: result.error });
      console.error(`[iCal cron] Sync failed — ${feed.feedName} (${feed.platform}):`, result.error);
    } else {
      console.log(
        `[iCal cron] ${feed.feedName} (${feed.platform}) — ` +
          `created: ${result.created}, updated: ${result.updated}, skipped: ${result.skipped}`
      );
    }
  }

  const totalCreated = results.reduce((s, r) => s + r.created, 0);
  const totalUpdated = results.reduce((s, r) => s + r.updated, 0);
  const totalSkipped = results.reduce((s, r) => s + r.skipped, 0);

  return NextResponse.json({
    ok: true,
    synced: feeds.length,
    totalCreated,
    totalUpdated,
    totalSkipped,
    errors: errors.length > 0 ? errors : undefined,
  });
}
