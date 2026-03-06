/**
 * MrCA iCal Export — Public feed for OTA subscription
 * GET /api/ical/export/[token]
 *
 * Token = base64url(roomId:orgId) signed with HMAC-SHA256 using ICAL_SECRET env var.
 * Format: <payload>.<signature>
 *
 * OTAs (Booking.com, Airbnb, Lekkerslaap) call this URL periodically to sync blocked dates.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";

const SECRET = process.env.ICAL_SECRET ?? "mrca-ical-secret-2026";

export function signToken(roomId: string, orgId: string): string {
  const payload = Buffer.from(`${roomId}:${orgId}`).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyToken(token: string): { roomId: string; orgId: string } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", SECRET).update(payload).digest("base64url");
  if (sig !== expected) return null;
  try {
    const [roomId, orgId] = Buffer.from(payload, "base64url").toString().split(":");
    if (!roomId || !orgId) return null;
    return { roomId, orgId };
  } catch {
    return null;
  }
}

function escapeIcal(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function toIcalDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const parsed = verifyToken(token);

  if (!parsed) {
    return new NextResponse("Invalid token", { status: 401 });
  }

  const { roomId, orgId } = parsed;

  // Verify room belongs to org
  const room = await prisma.room.findFirst({
    where: { id: roomId, property: { organisationId: orgId }, deletedAt: null },
    include: { property: { select: { name: true } } },
  });

  if (!room) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Fetch confirmed/checked-in bookings for this room (future + recent past)
  const since = new Date();
  since.setMonth(since.getMonth() - 1); // include 1 month back

  const bookings = await prisma.booking.findMany({
    where: {
      roomId,
      status: { in: ["CONFIRMED", "CHECKED_IN"] },
      checkOut: { gte: since },
      deletedAt: null,
    },
    orderBy: { checkIn: "asc" },
  });

  const now = toIcalDate(new Date());
  const propertyName = escapeIcal(room.property.name);
  const roomName = escapeIcal(room.name);

  const events = bookings.map((b) => {
    const uid = `${b.id}@mrca.co.za`;
    const dtStart = toIcalDate(new Date(b.checkIn));
    const dtEnd = toIcalDate(new Date(b.checkOut));
    const summary = escapeIcal(`Booking - ${b.guestName}`);
    return [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${propertyName} - ${roomName}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
    ].join("\r\n");
  });

  const ical = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MrCA//Booking Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${propertyName} - ${roomName}`,
    "X-WR-TIMEZONE:Africa/Johannesburg",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ical, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="mrca-${roomId}.ics"`,
      "Cache-Control": "no-cache, no-store",
    },
  });
}
