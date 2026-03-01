"use server";

import { prisma } from "@/lib/prisma";
import {
  calcOccupancyRate,
  calcADR,
  calcRevPAR,
  calcNights,
} from "@/lib/kpi";
import { toNumber } from "@/lib/utils";
import { startOfMonth, endOfMonth, addDays } from "date-fns";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { logger } from "@/lib/logger";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getDashboardKPIs(propertyId?: string) {
  // ─── Always scope to the current user's org ──────────────────────────────
  const session = await getServerSession(authOptions);
  const organisationId = (session?.user as { organisationId?: string })?.organisationId;

  if (!organisationId) {
    // Unauthenticated — return empty state
    return emptyKPIs();
  }

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const nextWeek = addDays(now, 7);

  // Filter properties to this org only
  const propertyWhere = {
    deletedAt: null as null,
    isActive: true,
    organisationId,
    ...(propertyId ? { id: propertyId } : {}),
  };

  // For bookings/transactions: filter via property relation to ensure org isolation
  const propertyFilter = propertyId
    ? { propertyId }
    : { property: { organisationId } };

  // ─── Batch all independent queries in parallel ───────────────────────────
  const [properties, monthBookings, recentTransactions, upcomingBookings, cashAgg] =
    await Promise.all([
      // 1. Properties + rooms for total room count (org-scoped)
      prisma.property.findMany({
        where: propertyWhere,
        select: {
          id: true,
          rooms: {
            where: { deletedAt: null, status: "ACTIVE" },
            select: { id: true },
          },
        },
      }),

      // 2. Current month bookings (org-scoped)
      prisma.booking.findMany({
        where: {
          deletedAt: null,
          ...propertyFilter,
          status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
          OR: [
            { checkIn: { gte: monthStart, lte: monthEnd } },
            { checkOut: { gte: monthStart, lte: monthEnd } },
            { checkIn: { lte: monthStart }, checkOut: { gte: monthEnd } },
          ],
        },
        select: {
          id: true,
          checkIn: true,
          checkOut: true,
          netAmount: true,
        },
      }),

      // 3. Recent transactions — last 10 (org-scoped)
      prisma.transaction.findMany({
        where: { deletedAt: null, ...propertyFilter },
        include: { property: { select: { name: true } } },
        orderBy: { date: "desc" },
        take: 10,
      }),

      // 4. Upcoming bookings — next 7 days (org-scoped)
      prisma.booking.findMany({
        where: {
          deletedAt: null,
          ...propertyFilter,
          checkIn: { gte: now, lte: nextWeek },
          status: { in: ["CONFIRMED", "CHECKED_IN"] },
        },
        include: {
          room: { select: { name: true, type: true } },
          property: { select: { name: true } },
        },
        orderBy: { checkIn: "asc" },
        take: 10,
      }),

      // 5. Cash position: cleared income vs expenses (org-scoped)
      prisma.transaction.groupBy({
        by: ["type"],
        where: {
          deletedAt: null,
          status: { in: [TransactionStatus.CLEARED, TransactionStatus.RECONCILED] },
          ...propertyFilter,
        },
        _sum: { amount: true },
      }),
    ]);

  // ─── Compute KPIs ────────────────────────────────────────────────────────
  const totalRooms = properties.reduce((sum, p) => sum + p.rooms.length, 0);
  const daysInMonth = monthEnd.getDate();

  const totalRevenue = monthBookings.reduce(
    (sum, b) => sum + toNumber(b.netAmount),
    0
  );

  const occupiedRoomNights = monthBookings.reduce((sum, b) => {
    try {
      const nights = calcNights(new Date(b.checkIn), new Date(b.checkOut));
      return sum + nights;
    } catch {
      return sum;
    }
  }, 0);

  const occupancyRate = calcOccupancyRate(occupiedRoomNights, totalRooms, daysInMonth);
  const adr = calcADR(totalRevenue, occupiedRoomNights);
  const revpar = calcRevPAR(totalRevenue, totalRooms, daysInMonth);

  const incomeTotal = cashAgg.find((r) => r.type === TransactionType.INCOME)?._sum.amount;
  const expenseTotal = cashAgg.find((r) => r.type === TransactionType.EXPENSE)?._sum.amount;
  const cashPosition =
    toNumber(incomeTotal ?? 0) - toNumber(expenseTotal ?? 0);

  logger.debug("Dashboard KPIs computed", {
    organisationId,
    propertyId,
    totalRooms,
    totalRevenue,
    occupancyRate,
    bookings: monthBookings.length,
  });

  return {
    totalRevenue,
    occupancyRate,
    adr,
    revpar,
    occupiedRoomNights,
    totalRooms,
    recentTransactions,
    upcomingBookings,
    cashPosition,
    period: {
      start: monthStart,
      end: monthEnd,
    },
  };
}

function emptyKPIs() {
  const now = new Date();
  return {
    totalRevenue: 0,
    occupancyRate: 0,
    adr: 0,
    revpar: 0,
    occupiedRoomNights: 0,
    totalRooms: 0,
    recentTransactions: [] as never[],
    upcomingBookings: [] as never[],
    cashPosition: 0,
    period: {
      start: startOfMonth(now),
      end: endOfMonth(now),
    },
  };
}
