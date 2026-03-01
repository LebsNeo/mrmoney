"use server";

/**
 * MrMoney Intelligence Layer — Step 3
 *
 * Computes booking-driven analytics:
 *   - Channel mix (revenue + bookings by source)
 *   - Occupancy by room
 *   - Month-over-month revenue, occupancy, ADR, RevPAR
 *   - Top earning month / best occupancy month
 *   - Channel commission cost analysis
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth, subMonths, format, differenceInDays } from "date-fns";

type SessionUser = { organisationId?: string };

async function getOrgId(): Promise<string> {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as SessionUser)?.organisationId;
  if (!orgId) throw new Error("Unauthorized");
  return orgId;
}

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return parseFloat(String(v)) || 0;
}

function nights(checkIn: Date | string, checkOut: Date | string): number {
  const n = differenceInDays(new Date(checkOut), new Date(checkIn));
  return Math.max(0, n);
}

// ─── Channel Mix ─────────────────────────────────────────────────────────────

export interface ChannelStat {
  source: string
  bookings: number
  roomNights: number
  grossRevenue: number
  totalCommission: number
  netRevenue: number
  avgNights: number
  avgRate: number          // gross / roomNights (ADR for channel)
  commissionRate: number   // commission / gross
  revenueShare: number     // % of total net
}

export async function getChannelMix(propertyId?: string, monthsBack = 1) {
  try {
    const orgId = await getOrgId();

    const now = new Date();
    const start = startOfMonth(subMonths(now, monthsBack - 1));
    const end = endOfMonth(now);

    const bookings = await prisma.booking.findMany({
      where: {
        property: { organisationId: orgId },
        ...(propertyId ? { propertyId } : {}),
        deletedAt: null,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        OR: [
          { checkIn: { gte: start, lte: end } },
          { checkOut: { gte: start, lte: end } },
          { checkIn: { lte: start }, checkOut: { gte: end } },
        ],
      },
      select: {
        source: true,
        checkIn: true,
        checkOut: true,
        grossAmount: true,
        otaCommission: true,
        netAmount: true,
      },
    });

    // Group by source
    const map = new Map<string, {
      bookings: number;
      roomNights: number;
      gross: number;
      commission: number;
      net: number;
    }>();

    let totalNet = 0;

    for (const b of bookings) {
      const key = b.source;
      const n = nights(b.checkIn, b.checkOut);
      const gross = toNum(b.grossAmount);
      const comm = toNum(b.otaCommission);
      const net = toNum(b.netAmount);

      const existing = map.get(key) ?? { bookings: 0, roomNights: 0, gross: 0, commission: 0, net: 0 };
      map.set(key, {
        bookings: existing.bookings + 1,
        roomNights: existing.roomNights + n,
        gross: existing.gross + gross,
        commission: existing.commission + comm,
        net: existing.net + net,
      });
      totalNet += net;
    }

    const channels: ChannelStat[] = Array.from(map.entries())
      .map(([source, d]) => ({
        source,
        bookings: d.bookings,
        roomNights: d.roomNights,
        grossRevenue: d.gross,
        totalCommission: d.commission,
        netRevenue: d.net,
        avgNights: d.bookings > 0 ? d.roomNights / d.bookings : 0,
        avgRate: d.roomNights > 0 ? d.gross / d.roomNights : 0,
        commissionRate: d.gross > 0 ? d.commission / d.gross : 0,
        revenueShare: totalNet > 0 ? d.net / totalNet : 0,
      }))
      .sort((a, b) => b.netRevenue - a.netRevenue);

    return {
      ok: true as const,
      data: {
        channels,
        totalNet,
        totalBookings: bookings.length,
        totalCommission: channels.reduce((s, c) => s + c.totalCommission, 0),
        period: { start: start.toISOString(), end: end.toISOString() },
      },
    };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

// ─── Occupancy by Room ────────────────────────────────────────────────────────

export interface RoomOccupancyStat {
  roomId: string
  roomName: string
  roomType: string
  baseRate: number
  nights: number
  occupiedNights: number
  occupancyRate: number
  revenue: number
  revpar: number      // revenue / daysInPeriod
  adr: number         // revenue / occupiedNights
}

export async function getRoomOccupancy(propertyId: string, monthsBack = 1) {
  try {
    const orgId = await getOrgId();

    const now = new Date();
    const start = startOfMonth(subMonths(now, monthsBack - 1));
    const end = endOfMonth(now);
    const daysInPeriod = differenceInDays(end, start) + 1;

    const property = await prisma.property.findFirst({
      where: { id: propertyId, organisationId: orgId },
      select: { id: true },
    });
    if (!property) return { ok: false as const, error: "Property not found" };

    const rooms = await prisma.room.findMany({
      where: { propertyId, deletedAt: null },
      select: { id: true, name: true, type: true, baseRate: true },
      orderBy: { name: "asc" },
    });

    const bookings = await prisma.booking.findMany({
      where: {
        propertyId,
        deletedAt: null,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        OR: [
          { checkIn: { gte: start, lte: end } },
          { checkOut: { gte: start, lte: end } },
          { checkIn: { lte: start }, checkOut: { gte: end } },
        ],
      },
      select: { roomId: true, checkIn: true, checkOut: true, netAmount: true },
    });

    const stats: RoomOccupancyStat[] = rooms.map((room) => {
      const roomBookings = bookings.filter((b) => b.roomId === room.id);
      let occupiedNights = 0;
      let revenue = 0;

      for (const b of roomBookings) {
        // Clamp to period
        const bIn = new Date(b.checkIn) < start ? start : new Date(b.checkIn);
        const bOut = new Date(b.checkOut) > end ? end : new Date(b.checkOut);
        const n = Math.max(0, differenceInDays(bOut, bIn));
        occupiedNights += n;
        revenue += toNum(b.netAmount);
      }

      return {
        roomId: room.id,
        roomName: room.name,
        roomType: room.type,
        baseRate: toNum(room.baseRate),
        nights: daysInPeriod,
        occupiedNights,
        occupancyRate: daysInPeriod > 0 ? occupiedNights / daysInPeriod : 0,
        revenue,
        revpar: daysInPeriod > 0 ? revenue / daysInPeriod : 0,
        adr: occupiedNights > 0 ? revenue / occupiedNights : 0,
      };
    });

    return {
      ok: true as const,
      data: { rooms: stats, period: { start: start.toISOString(), end: end.toISOString(), days: daysInPeriod } },
    };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

// ─── Month-over-Month Trend (last N months) ───────────────────────────────────

export interface MonthlySnapshot {
  month: string         // "Jan 25"
  isoMonth: string      // "2025-01"
  revenue: number
  expenses: number
  netProfit: number
  bookings: number
  roomNights: number
  occupancyRate: number
  adr: number
  revpar: number
  commissionCost: number
}

export async function getMonthlyTrend(propertyId?: string, monthsBack = 6) {
  try {
    const orgId = await getOrgId();
    const now = new Date();
    const snapshots: MonthlySnapshot[] = [];

    // Fetch total room count once
    const totalRooms = propertyId
      ? await prisma.room.count({ where: { propertyId, deletedAt: null } })
      : await prisma.room.count({
          where: { property: { organisationId: orgId }, deletedAt: null },
        });

    for (let i = monthsBack - 1; i >= 0; i--) {
      const ref = subMonths(now, i);
      const start = startOfMonth(ref);
      const end = endOfMonth(ref);
      const daysInMonth = differenceInDays(end, start) + 1;

      const [bookings, txAgg] = await Promise.all([
        prisma.booking.findMany({
          where: {
            property: { organisationId: orgId },
            ...(propertyId ? { propertyId } : {}),
            deletedAt: null,
            status: { notIn: ["CANCELLED", "NO_SHOW"] },
            OR: [
              { checkIn: { gte: start, lte: end } },
              { checkOut: { gte: start, lte: end } },
              { checkIn: { lte: start }, checkOut: { gte: end } },
            ],
          },
          select: { checkIn: true, checkOut: true, netAmount: true, grossAmount: true, otaCommission: true },
        }),
        prisma.transaction.groupBy({
          by: ["type"],
          where: {
            property: { organisationId: orgId },
            ...(propertyId ? { propertyId } : {}),
            deletedAt: null,
            date: { gte: start, lte: end },
          },
          _sum: { amount: true },
        }),
      ]);

      let roomNights = 0;
      let revenue = 0;
      let commissionCost = 0;

      for (const b of bookings) {
        const bIn = new Date(b.checkIn) < start ? start : new Date(b.checkIn);
        const bOut = new Date(b.checkOut) > end ? end : new Date(b.checkOut);
        const n = Math.max(0, differenceInDays(bOut, bIn));
        roomNights += n;
        revenue += toNum(b.netAmount);
        commissionCost += toNum(b.otaCommission);
      }

      const incomeAgg = txAgg.find((r) => r.type === "INCOME")?._sum.amount;
      const expenseAgg = txAgg.find((r) => r.type === "EXPENSE")?._sum.amount;
      const expenses = toNum(expenseAgg);

      const occupancyRate = totalRooms > 0 && daysInMonth > 0
        ? roomNights / (totalRooms * daysInMonth)
        : 0;

      snapshots.push({
        month: format(ref, "MMM yy"),
        isoMonth: format(ref, "yyyy-MM"),
        revenue,
        expenses,
        netProfit: revenue - expenses,
        bookings: bookings.length,
        roomNights,
        occupancyRate,
        adr: roomNights > 0 ? revenue / roomNights : 0,
        revpar: totalRooms > 0 && daysInMonth > 0 ? revenue / (totalRooms * daysInMonth) : 0,
        commissionCost,
      });
    }

    return { ok: true as const, data: snapshots };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

// ─── Intelligence Summary (single call for dashboard) ────────────────────────

export async function getIntelligenceSummary(propertyId?: string) {
  try {
    const orgId = await getOrgId();
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    const totalRooms = propertyId
      ? await prisma.room.count({ where: { propertyId, deletedAt: null } })
      : await prisma.room.count({
          where: { property: { organisationId: orgId }, deletedAt: null },
        });

    const daysThisMonth = differenceInDays(thisMonthEnd, thisMonthStart) + 1;
    const daysLastMonth = differenceInDays(lastMonthEnd, lastMonthStart) + 1;
    const daysElapsed = Math.min(differenceInDays(now, thisMonthStart) + 1, daysThisMonth);

    async function getMonthBookings(start: Date, end: Date) {
      return prisma.booking.findMany({
        where: {
          property: { organisationId: orgId },
          ...(propertyId ? { propertyId } : {}),
          deletedAt: null,
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
          OR: [
            { checkIn: { gte: start, lte: end } },
            { checkOut: { gte: start, lte: end } },
            { checkIn: { lte: start }, checkOut: { gte: end } },
          ],
        },
        select: {
          source: true,
          checkIn: true,
          checkOut: true,
          grossAmount: true,
          otaCommission: true,
          netAmount: true,
        },
      });
    }

    const [thisMonthBookings, lastMonthBookings] = await Promise.all([
      getMonthBookings(thisMonthStart, thisMonthEnd),
      getMonthBookings(lastMonthStart, lastMonthEnd),
    ]);

    function summarise(bookings: typeof thisMonthBookings, days: number) {
      let roomNights = 0, revenue = 0, commission = 0;
      for (const b of bookings) {
        roomNights += nights(b.checkIn, b.checkOut);
        revenue += toNum(b.netAmount);
        commission += toNum(b.otaCommission);
      }
      const occ = totalRooms > 0 && days > 0 ? roomNights / (totalRooms * days) : 0;
      return {
        bookings: bookings.length,
        roomNights,
        revenue,
        commission,
        occupancy: occ,
        adr: roomNights > 0 ? revenue / roomNights : 0,
        revpar: totalRooms > 0 && days > 0 ? revenue / (totalRooms * days) : 0,
      };
    }

    const thisMonth = summarise(thisMonthBookings, daysElapsed);
    const lastMonth = summarise(lastMonthBookings, daysLastMonth);

    function pct(curr: number, prev: number) {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / prev) * 100;
    }

    // Pace: project this month's revenue based on elapsed days
    const pace = daysThisMonth > 0 && daysElapsed > 0
      ? (thisMonth.revenue / daysElapsed) * daysThisMonth
      : 0;

    return {
      ok: true as const,
      data: {
        totalRooms,
        daysElapsed,
        daysInMonth: daysThisMonth,
        thisMonth,
        lastMonth,
        mom: {
          revenue: pct(thisMonth.revenue, lastMonth.revenue),
          occupancy: pct(thisMonth.occupancy, lastMonth.occupancy),
          adr: pct(thisMonth.adr, lastMonth.adr),
          revpar: pct(thisMonth.revpar, lastMonth.revpar),
          commission: pct(thisMonth.commission, lastMonth.commission),
        },
        pace,           // Projected month-end revenue at current run rate
      },
    };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}
