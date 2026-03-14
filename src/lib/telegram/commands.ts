/**
 * MrCA — Telegram Staff Bot Commands
 * Staff-facing: tonight's house, revenue, occupancy, bookings, digest
 */

import { prisma } from "@/lib/prisma";
import { buildDigest, formatDigestMessage } from "@/lib/whatsapp/daily-digest";
import { UserRole } from "@prisma/client";
import { canViewFinance } from "./bot";

function R(n: number): string {
  return `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function saToday(): { start: Date; end: Date; tomorrow: Date; saDate: Date } {
  // checkIn/checkOut are @db.Date — use UTC midnight dates for SAST day boundaries
  const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;
  const sastNow = new Date(Date.now() + SAST_OFFSET_MS);
  const y = sastNow.getUTCFullYear(), m = sastNow.getUTCMonth(), d = sastNow.getUTCDate();
  const start    = new Date(Date.UTC(y, m, d));
  const tomorrow = new Date(Date.UTC(y, m, d + 1));
  const end      = new Date(tomorrow.getTime() - 1);
  return { start, end, tomorrow, saDate: sastNow };
}

// ─── /help ────────────────────────────────────────────────────────────────────

export async function cmdHelp(role: UserRole): Promise<string> {
  const lines = [
    "🏨 <b>MrCA Staff Bot</b>",
    "",
    "Available commands:",
    "/tonight — Tonight's house (arrivals, in-house, departures)",
    "/occupancy — Current occupancy across all properties",
    "/bookings — Next 5 upcoming check-ins",
  ];

  if (canViewFinance(role)) {
    lines.push("/revenue — Today's revenue + month-to-date");
    lines.push("/digest — Full morning digest");
  }

  lines.push("/help — This menu");
  return lines.join("\n");
}

// ─── /tonight ────────────────────────────────────────────────────────────────

export async function cmdTonight(orgId: string): Promise<string> {
  const { start, end, tomorrow, saDate } = saToday();
  const todayStr = saDate.toLocaleDateString("en-ZA", {
    weekday: "long", day: "numeric", month: "long",
  });

  const properties = await prisma.property.findMany({
    where: { organisationId: orgId, isActive: true, deletedAt: null },
    include: { rooms: { where: { deletedAt: null, status: "ACTIVE" } } },
    orderBy: { name: "asc" },
  });

  if (properties.length === 0) return "No active properties found.";

  const lines: string[] = [`🌙 <b>Tonight's House — ${todayStr}</b>`, ""];

  for (const prop of properties) {
    const totalRooms = prop.rooms.length;

    const arriving = await prisma.booking.findMany({
      where: {
        propertyId: prop.id, deletedAt: null,
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        checkIn: { gte: start, lt: tomorrow },
      },
      select: { guestName: true },
    });

    const departing = await prisma.booking.findMany({
      where: {
        propertyId: prop.id, deletedAt: null,
        status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
        checkOut: { gte: start, lt: tomorrow },
      },
      select: { guestName: true },
    });

    const inHouse = await prisma.booking.findMany({
      where: {
        propertyId: prop.id, deletedAt: null,
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        checkIn: { lt: start },
        checkOut: { gt: start },
      },
      select: { guestName: true },
    });

    const occupied = arriving.length + inHouse.length;
    const pct = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;

    lines.push(`<b>${prop.name}</b> — ${occupied}/${totalRooms} rooms (${pct}%)`);

    if (arriving.length > 0)  lines.push(`  🛬 Arriving: ${arriving.map((b) => b.guestName).join(", ")}`);
    if (inHouse.length > 0)   lines.push(`  🏠 In-house: ${inHouse.map((b) => b.guestName).join(", ")}`);
    if (departing.length > 0) lines.push(`  🛫 Departing: ${departing.map((b) => b.guestName).join(", ")}`);
    if (arriving.length === 0 && inHouse.length === 0 && departing.length === 0) {
      lines.push("  — No guests tonight");
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

// ─── /revenue ────────────────────────────────────────────────────────────────

export async function cmdRevenue(orgId: string): Promise<string> {
  const { start, end, saDate } = saToday();
  const monthStart = new Date(saDate.getFullYear(), saDate.getMonth(), 1);

  const [todayTx, mtdTx] = await Promise.all([
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { organisationId: orgId, deletedAt: null, type: "INCOME", date: { gte: start, lte: end } },
    }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { organisationId: orgId, deletedAt: null, type: "INCOME", date: { gte: monthStart, lte: end } },
    }),
  ]);

  const todayAmount = Number(todayTx._sum.amount ?? 0);
  const mtdAmount   = Number(mtdTx._sum.amount  ?? 0);
  const monthName   = saDate.toLocaleDateString("en-ZA", { month: "long" });

  return [
    "💰 <b>Revenue Summary</b>",
    "",
    `Today:  <b>${R(todayAmount)}</b>`,
    `${monthName} MTD:  <b>${R(mtdAmount)}</b>`,
  ].join("\n");
}

// ─── /occupancy ───────────────────────────────────────────────────────────────

export async function cmdOccupancy(orgId: string): Promise<string> {
  const { start, end } = saToday();

  const properties = await prisma.property.findMany({
    where: { organisationId: orgId, isActive: true, deletedAt: null },
    include: { rooms: { where: { deletedAt: null, status: "ACTIVE" } } },
    orderBy: { name: "asc" },
  });

  if (properties.length === 0) return "No active properties found.";

  const lines: string[] = ["🏨 <b>Current Occupancy</b>", ""];
  let totalRooms = 0;
  let totalOccupied = 0;

  for (const prop of properties) {
    const rooms = prop.rooms.length;
    const occupied = await prisma.booking.count({
      where: {
        propertyId: prop.id, deletedAt: null,
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        checkIn: { lte: end },
        checkOut: { gt: start },
      },
    });
    const pct = rooms > 0 ? Math.round((occupied / rooms) * 100) : 0;
    const bar = "█".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));

    lines.push(`<b>${prop.name}</b>`);
    lines.push(`  ${bar} ${pct}%  (${occupied}/${rooms} rooms)`);
    lines.push("");

    totalRooms += rooms;
    totalOccupied += occupied;
  }

  if (properties.length > 1) {
    const overallPct = totalRooms > 0 ? Math.round((totalOccupied / totalRooms) * 100) : 0;
    lines.push(`<b>Overall: ${overallPct}% (${totalOccupied}/${totalRooms})</b>`);
  }

  return lines.join("\n").trim();
}

// ─── /bookings ────────────────────────────────────────────────────────────────

export async function cmdBookings(orgId: string): Promise<string> {
  const now = new Date();

  const upcoming = await prisma.booking.findMany({
    where: {
      property: { organisationId: orgId },
      deletedAt: null,
      status: { in: ["CONFIRMED"] },
      checkIn: { gte: now },
    },
    orderBy: { checkIn: "asc" },
    take: 5,
    include: {
      property: { select: { name: true } },
      room:     { select: { name: true } },
    },
  });

  if (upcoming.length === 0) return "📅 No upcoming confirmed bookings.";

  const lines = ["📅 <b>Next 5 Check-ins</b>", ""];

  for (const b of upcoming) {
    const checkIn  = new Date(b.checkIn).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
    const checkOut = new Date(b.checkOut).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
    const nights   = Math.round((b.checkOut.getTime() - b.checkIn.getTime()) / 86400000);
    lines.push(`• <b>${b.guestName}</b>`);
    lines.push(`  ${checkIn} → ${checkOut} (${nights}n) · ${b.room?.name ?? "?"} · ${b.property.name}`);
    lines.push(`  ${R(Number(b.grossAmount))} · ${b.source.replace(/_/g, " ")}`);
    lines.push("");
  }

  return lines.join("\n").trim();
}

// ─── /digest ─────────────────────────────────────────────────────────────────

export async function cmdDigest(orgId: string): Promise<string> {
  const data = await buildDigest(orgId);
  if (!data) return "Could not build digest — no data found.";
  return formatDigestMessage(data);
}
