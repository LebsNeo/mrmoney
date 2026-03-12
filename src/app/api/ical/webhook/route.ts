/**
 * MrCA — iCal Webhook Trigger
 *
 * Triggers an immediate iCal sync for all feeds on a property.
 * Designed to be called by:
 *   - Booking.com (configure in extranet → Connectivity → Push notification URL)
 *   - Internally from booking create/update mutations
 *   - Any OTA that supports push pings
 *
 * Auth: ICAL_WEBHOOK_SECRET env var (falls back to CRON_SECRET; open in dev if neither set)
 *
 * Usage:
 *   POST /api/ical/webhook?propertyId=xxx&secret=yyy
 *   POST /api/ical/webhook        (body: { propertyId?, secret? })
 */

import { NextRequest, NextResponse } from "next/server";
import { syncAllFeeds } from "@/lib/ical-sync";

export const maxDuration = 60;

function isAuthorised(req: NextRequest, bodySecret?: string): boolean {
  const secret = process.env.ICAL_WEBHOOK_SECRET ?? process.env.CRON_SECRET;
  if (!secret) return true; // dev mode — no secret configured

  // Accept secret via query param, body, or Authorization header
  const querySecret = req.nextUrl.searchParams.get("secret");
  const authHeader = req.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  return (
    querySecret === secret ||
    bodySecret === secret ||
    bearerSecret === secret
  );
}

export async function POST(req: NextRequest) {
  let bodySecret: string | undefined;
  let bodyPropertyId: string | undefined;

  try {
    const body = await req.json().catch(() => ({}));
    bodySecret = body?.secret;
    bodyPropertyId = body?.propertyId;
  } catch {
    // body not required
  }

  if (!isAuthorised(req, bodySecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // propertyId can come from query or body — if omitted, sync ALL active feeds
  const propertyId =
    req.nextUrl.searchParams.get("propertyId") ?? bodyPropertyId ?? undefined;

  const results = await syncAllFeeds(propertyId);

  const totalCreated = results.reduce((s, r) => s + r.created, 0);
  const totalUpdated = results.reduce((s, r) => s + r.updated, 0);
  const totalSkipped = results.reduce((s, r) => s + r.skipped, 0);
  const errors = results.filter((r) => r.error).map((r) => ({ feed: r.feedName, error: r.error }));

  return NextResponse.json({
    ok: true,
    synced: results.length,
    totalCreated,
    totalUpdated,
    totalSkipped,
    ...(errors.length > 0 ? { errors } : {}),
  });
}

// GET also supported — some OTAs send a GET ping
export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const propertyId = req.nextUrl.searchParams.get("propertyId") ?? undefined;
  const results = await syncAllFeeds(propertyId);

  const totalCreated = results.reduce((s, r) => s + r.created, 0);
  const totalUpdated = results.reduce((s, r) => s + r.updated, 0);
  const totalSkipped = results.reduce((s, r) => s + r.skipped, 0);
  const errors = results.filter((r) => r.error).map((r) => ({ feed: r.feedName, error: r.error }));

  return NextResponse.json({
    ok: true,
    synced: results.length,
    totalCreated,
    totalUpdated,
    totalSkipped,
    ...(errors.length > 0 ? { errors } : {}),
  });
}
