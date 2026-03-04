/**
 * MrCA — Daily Digest
 * Returns a snapshot of yesterday's performance and today's schedule
 */

import { prisma } from "./prisma";
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth } from "date-fns";

export interface ArrivalPaymentInfo {
  bookingId: string;
  guestName: string;
  roomName: string;
  nights: number;
  grossAmount: number;
  amountPaid: number;
  balance: number;
  paymentMethod: string | null;  // CASH | EFT | CARD | null (unpaid)
  paidAt: string | null;          // ISO date string
  paymentStatus: "PAID_IN_FULL" | "PARTIAL" | "UNPAID";
}

export interface DailyDigest {
  yesterdayRevenue: number;
  yesterdayCheckouts: number;
  todayCheckIns: number;
  todayCheckOuts: number;
  todayArrivals: ArrivalPaymentInfo[];
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

  // Today check-ins (count)
  const todayCheckIns = await prisma.booking.count({
    where: {
      propertyId,
      deletedAt: null,
      checkIn: { gte: todayStart, lte: todayEnd },
    },
  });

  // Today arrivals — full detail with payment info
  const arrivalBookings = await prisma.booking.findMany({
    where: {
      propertyId,
      deletedAt: null,
      checkIn: { gte: todayStart, lte: todayEnd },
    },
    include: {
      room: true,
      bookingRooms: {
        where: { deletedAt: null },
        include: { room: true },
      },
      transactions: {
        where: { deletedAt: null, type: "INCOME", status: "CLEARED" },
        orderBy: { date: "asc" },
      },
      invoices: {
        where: { deletedAt: null },
        include: {
          receipts: {
            where: { deletedAt: null },
            orderBy: { date: "asc" },
          },
        },
      },
    },
    orderBy: { checkIn: "asc" },
  });

  const todayArrivals: ArrivalPaymentInfo[] = arrivalBookings.map((b) => {
    const nights = Math.max(1, Math.round(
      (new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) / 86400000
    ));
    const grossAmount = parseFloat(b.grossAmount.toString());
    const amountPaid = b.transactions.reduce(
      (sum: number, t: { amount: { toString: () => string } }) => sum + parseFloat(t.amount.toString()), 0
    );
    const balance = Math.max(0, grossAmount - amountPaid);

    // Payment method: check receipts first (from mark-as-paid), then parse transaction description
    const allReceipts = b.invoices.flatMap((inv: { receipts: { paymentMethod: string; date: Date }[] }) => inv.receipts);
    const latestReceipt = allReceipts[allReceipts.length - 1];
    const latestTx = b.transactions[b.transactions.length - 1];

    let paymentMethod: string | null = latestReceipt?.paymentMethod ?? null;
    let paidAt: string | null = latestReceipt?.date ? new Date(latestReceipt.date).toISOString() : null;

    // Fall back to parsing transaction description if no receipt
    if (!paymentMethod && latestTx?.description) {
      const desc = (latestTx.description as string).toLowerCase();
      if (desc.includes("cash")) paymentMethod = "CASH";
      else if (desc.includes("eft")) paymentMethod = "EFT";
      else if (desc.includes("card")) paymentMethod = "CARD";
      paidAt = paidAt ?? (latestTx.date ? new Date(latestTx.date as Date).toISOString() : null);
    }

    const paymentStatus: ArrivalPaymentInfo["paymentStatus"] =
      amountPaid === 0 ? "UNPAID" :
      balance > 0.01 ? "PARTIAL" : "PAID_IN_FULL";

    // Room name: multi-room or single
    const brList = b.bookingRooms as { room: { name: string } }[];
    const roomName = brList.length > 1
      ? brList.map(br => br.room.name).join(", ")
      : b.room?.name ?? "Room";

    return {
      bookingId: b.id,
      guestName: b.guestName,
      roomName,
      nights,
      grossAmount,
      amountPaid,
      balance,
      paymentMethod,
      paidAt,
      paymentStatus,
    };
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
        topInsight = `Top earner this month: ${topBooking.room?.name ?? "Room"} at R${topAmt.toFixed(2)}.`;
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
    todayArrivals,
    overdueInvoices,
    unmatchedPayouts,
    cashPosition,
    topInsight,
  };
}
