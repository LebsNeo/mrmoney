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

export async function getDashboardKPIs(propertyId?: string) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const nextWeek = addDays(now, 7);

  const propertyFilter = propertyId ? { propertyId } : {};

  // Fetch all properties to get total room count
  const properties = await prisma.property.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      ...(propertyId ? { id: propertyId } : {}),
    },
    include: {
      rooms: {
        where: { deletedAt: null, status: "ACTIVE" },
        select: { id: true },
      },
    },
  });
  const totalRooms = properties.reduce((sum, p) => sum + p.rooms.length, 0);
  const daysInMonth = monthEnd.getDate();

  // Current month bookings (confirmed, checked_in, checked_out)
  const monthBookings = await prisma.booking.findMany({
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
  });

  // Total revenue (sum of netAmount for month bookings)
  const totalRevenue = monthBookings.reduce(
    (sum, b) => sum + toNumber(b.netAmount),
    0
  );

  // Occupied room-nights in the month
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

  // Recent transactions (last 10)
  const recentTransactions = await prisma.transaction.findMany({
    where: {
      deletedAt: null,
      ...propertyFilter,
    },
    include: {
      property: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take: 10,
  });

  // Upcoming bookings (next 7 days)
  const upcomingBookings = await prisma.booking.findMany({
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
  });

  // Cash position: cleared income - cleared expenses
  const cashAgg = await prisma.transaction.groupBy({
    by: ["type"],
    where: {
      deletedAt: null,
      status: { in: [TransactionStatus.CLEARED, TransactionStatus.RECONCILED] },
      ...propertyFilter,
    },
    _sum: { amount: true },
  });

  const incomeTotal = cashAgg.find((r) => r.type === TransactionType.INCOME)?._sum.amount;
  const expenseTotal = cashAgg.find((r) => r.type === TransactionType.EXPENSE)?._sum.amount;
  const cashPosition =
    toNumber(incomeTotal ?? 0) - toNumber(expenseTotal ?? 0);

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
