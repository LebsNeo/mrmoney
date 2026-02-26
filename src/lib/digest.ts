/**
 * MrMoney — Daily Digest
 * Returns a snapshot of yesterday's performance and today's schedule
 */

import { prisma } from "./prisma";
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth } from "date-fns";

export interface DailyDigest {
  yesterdayRevenue: number;
  yesterdayCheckouts: number;
  todayCheckIns: number;
  todayCheckOuts: number;
  overdueInvoices: { count: number; totalAmount: number };
  unmatchedPayouts: number;
  cashPosition: number;
  topInsight: string;
}

export async function generateDailyDigest(
  organisationId: string,
  propertyId: string
): Promise<DailyDigest> {
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);
  const yesterday = subDays(today, 1);
  const yesterdayStart = startOfDay(yesterday);
  const yesterdayEnd = endOfDay(yesterday);

  // Yesterday revenue
  const yesterdayRevResult = await prisma.transaction.aggregate({
    where: {
      propertyId,
      type: "INCOME",
      deletedAt: null,
      date: { gte: yesterdayStart, lte: yesterdayEnd },
    },
    _sum: { amount: true },
  });
  const yesterdayRevenue = parseFloat((yesterdayRevResult._sum.amount ?? 0).toString());

  // Yesterday checkouts
  const yesterdayCheckouts = await prisma.booking.count({
    where: {
      propertyId,
      deletedAt: null,
      checkOut: { gte: yesterdayStart, lte: yesterdayEnd },
    },
  });

  // Today check-ins
  const todayCheckIns = await prisma.booking.count({
    where: {
      propertyId,
      deletedAt: null,
      checkIn: { gte: todayStart, lte: todayEnd },
    },
  });

  // Today check-outs
  const todayCheckOuts = await prisma.booking.count({
    where: {
      propertyId,
      deletedAt: null,
      checkOut: { gte: todayStart, lte: todayEnd },
    },
  });

  // Overdue invoices
  const overdueResult = await prisma.invoice.findMany({
    where: {
      organisationId,
      status: "SENT",
      dueDate: { lt: today },
      deletedAt: null,
    },
    select: { totalAmount: true },
  });
  const overdueInvoices = {
    count: overdueResult.length,
    totalAmount: overdueResult.reduce(
      (sum, inv) => sum + parseFloat(inv.totalAmount.toString()),
      0
    ),
  };

  // Unmatched payouts
  const unmatchedPayouts = await prisma.oTAPayoutItem.count({
    where: {
      isMatched: false,
      deletedAt: null,
      payout: { organisationId },
    },
  });

  // Cash position (CLEARED + RECONCILED income - expense)
  const clearedIncome = await prisma.transaction.aggregate({
    where: {
      propertyId,
      type: "INCOME",
      deletedAt: null,
      status: { in: ["CLEARED", "RECONCILED"] },
    },
    _sum: { amount: true },
  });
  const clearedExpense = await prisma.transaction.aggregate({
    where: {
      propertyId,
      type: "EXPENSE",
      deletedAt: null,
      status: { in: ["CLEARED", "RECONCILED"] },
    },
    _sum: { amount: true },
  });
  const cashPosition =
    parseFloat((clearedIncome._sum.amount ?? 0).toString()) -
    parseFloat((clearedExpense._sum.amount ?? 0).toString());

  // Top insight — find highest revenue room this month
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  let topInsight = "Keep an eye on your cash position today.";

  try {
    const roomRevenue = await prisma.transaction.groupBy({
      by: ["bookingId"],
      where: {
        propertyId,
        type: "INCOME",
        deletedAt: null,
        date: { gte: monthStart, lte: monthEnd },
        bookingId: { not: null },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 1,
    });

    if (roomRevenue.length > 0 && roomRevenue[0].bookingId) {
      const topBooking = await prisma.booking.findUnique({
        where: { id: roomRevenue[0].bookingId! },
        select: { room: { select: { name: true } } },
      });
      const topAmt = parseFloat((roomRevenue[0]._sum.amount ?? 0).toString());
      if (topBooking) {
        topInsight = `Top earner this month: ${topBooking.room.name} at R${topAmt.toFixed(2)}.`;
      }
    }

    // If no bookings, check if today has unusual check-in volume
    if (todayCheckIns > 3) {
      topInsight = `Busy day ahead — ${todayCheckIns} check-ins scheduled today!`;
    }

    if (overdueInvoices.count > 0) {
      topInsight = `${overdueInvoices.count} invoice(s) overdue (R${overdueInvoices.totalAmount.toFixed(2)}) — chase payment today.`;
    }
  } catch {
    // Non-critical
  }

  return {
    yesterdayRevenue,
    yesterdayCheckouts,
    todayCheckIns,
    todayCheckOuts,
    overdueInvoices,
    unmatchedPayouts,
    cashPosition,
    topInsight,
  };
}
