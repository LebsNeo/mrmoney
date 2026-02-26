/**
 * MrMoney — Forecasting Engine
 * Phase 4: Cash Flow, Revenue, Occupancy, Expense Forecasting & Break-Even Analysis
 */

import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { calcNights } from "@/lib/kpi";
import {
  addDays,
  format,
  startOfDay,
  startOfMonth,
  endOfMonth,
  subDays,
  addMonths,
  getDaysInMonth,
  getMonth,
  getYear,
  parseISO,
} from "date-fns";
import { BookingSource, BookingStatus, TransactionType } from "@prisma/client";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface DailyForecast {
  date: string; // ISO date YYYY-MM-DD
  expectedIncome: number;
  expectedExpenses: number;
  netCashFlow: number;
  cumulativeBalance: number;
}

export interface RevenueForecastMonth {
  period: string; // YYYY-MM
  confirmedRevenue: number;
  projectedRevenue: number;
  totalRooms: number;
  confirmedNights: number;
  projectedOccupancy: number;
}

export interface OccupancyForecastMonth {
  period: string;
  totalRoomNights: number;
  confirmedNights: number;
  projectedNights: number;
  confirmedOccupancy: number;
  projectedOccupancy: number;
}

export interface ExpenseForecastCategory {
  category: string;
  historicalAvg: number;
  projectedAmount: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export interface BreakEvenResult {
  breakEvenADR: number;
  currentADR: number;
  isAboveBreakEven: boolean;
  gap: number;
}

export interface OTAPayout {
  bookingId: string;
  guestName: string;
  checkOut: Date;
  expectedPayoutDate: Date;
  amount: number;
  source: string;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/** OTA payout delay in days */
function otaPayoutDelay(source: BookingSource): number {
  switch (source) {
    case BookingSource.AIRBNB:
      return 14;
    case BookingSource.BOOKING_COM:
      return 30;
    default:
      return 0;
  }
}

/** Average daily expense for a property over the last 90 days */
async function getAvgDailyExpense(propertyId: string): Promise<number> {
  const end = new Date();
  const start = subDays(end, 90);

  const result = await prisma.transaction.aggregate({
    where: {
      propertyId,
      type: TransactionType.EXPENSE,
      deletedAt: null,
      date: { gte: start, lte: end },
    },
    _sum: { amount: true },
  });

  const total = toNumber(result._sum.amount ?? 0);
  return total / 90;
}

/** Total rooms for a property */
async function getTotalRooms(propertyId: string): Promise<number> {
  const count = await prisma.room.count({
    where: { propertyId, status: "ACTIVE", deletedAt: null },
  });
  return count;
}

// ─────────────────────────────────────────────
// 1. CASH FLOW FORECAST
// ─────────────────────────────────────────────

export async function getCashFlowForecast(
  propertyId: string,
  daysAhead: 30 | 60 | 90
): Promise<{ days: DailyForecast[]; upcomingOTAPayouts: OTAPayout[] }> {
  const today = startOfDay(new Date());
  const windowEnd = addDays(today, daysAhead);

  // Confirmed bookings whose checkout is within window (+ OTA delay buffer)
  // We extend the booking query to cover potential payout dates within window
  const maxDelay = 30; // BOOKING_COM
  const bookingWindowStart = subDays(today, maxDelay); // checkout could be up to 30 days ago for BOOKING_COM

  const bookings = await prisma.booking.findMany({
    where: {
      propertyId,
      deletedAt: null,
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
      checkOut: { gte: bookingWindowStart, lte: windowEnd },
    },
    select: {
      id: true,
      source: true,
      guestName: true,
      checkOut: true,
      netAmount: true,
    },
  });

  // Map income to payout dates
  const incomeByDate = new Map<string, number>();
  const upcomingOTAPayouts: OTAPayout[] = [];

  for (const b of bookings) {
    const delay = otaPayoutDelay(b.source);
    const checkOutDate = new Date(b.checkOut);
    const payoutDate = startOfDay(addDays(checkOutDate, delay));

    if (payoutDate >= today && payoutDate <= windowEnd) {
      const key = format(payoutDate, "yyyy-MM-dd");
      incomeByDate.set(key, (incomeByDate.get(key) ?? 0) + toNumber(b.netAmount));

      if (b.source !== BookingSource.DIRECT) {
        upcomingOTAPayouts.push({
          bookingId: b.id,
          guestName: b.guestName,
          checkOut: checkOutDate,
          expectedPayoutDate: payoutDate,
          amount: toNumber(b.netAmount),
          source: b.source,
        });
      }
    }
  }

  // Sort OTA payouts by date
  upcomingOTAPayouts.sort(
    (a, b) => a.expectedPayoutDate.getTime() - b.expectedPayoutDate.getTime()
  );

  // Average daily expense
  const avgDailyExpense = await getAvgDailyExpense(propertyId);

  // Build day-by-day array
  const days: DailyForecast[] = [];
  let cumulative = 0;

  for (let i = 0; i < daysAhead; i++) {
    const date = addDays(today, i);
    const key = format(date, "yyyy-MM-dd");
    const expectedIncome = incomeByDate.get(key) ?? 0;
    const expectedExpenses = avgDailyExpense;
    const netCashFlow = expectedIncome - expectedExpenses;
    cumulative += netCashFlow;

    days.push({
      date: key,
      expectedIncome: round2(expectedIncome),
      expectedExpenses: round2(expectedExpenses),
      netCashFlow: round2(netCashFlow),
      cumulativeBalance: round2(cumulative),
    });
  }

  return { days, upcomingOTAPayouts };
}

// ─────────────────────────────────────────────
// 2. REVENUE FORECAST
// ─────────────────────────────────────────────

export async function getRevenueForecast(
  propertyId: string,
  months: number
): Promise<RevenueForecastMonth[]> {
  const today = new Date();
  const totalRooms = await getTotalRooms(propertyId);

  const result: RevenueForecastMonth[] = [];

  for (let m = 0; m < months; m++) {
    const targetMonth = addMonths(today, m);
    const period = format(targetMonth, "yyyy-MM");
    const monthStart = startOfMonth(targetMonth);
    const monthEnd = endOfMonth(targetMonth);
    const daysInMonthCount = getDaysInMonth(targetMonth);

    // Confirmed revenue from actual bookings in this period
    const bookings = await prisma.booking.findMany({
      where: {
        propertyId,
        deletedAt: null,
        status: {
          in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN],
        },
        OR: [
          { checkIn: { gte: monthStart, lte: monthEnd } },
          { checkOut: { gte: monthStart, lte: monthEnd } },
          { checkIn: { lte: monthStart }, checkOut: { gte: monthEnd } },
        ],
      },
      select: {
        netAmount: true,
        checkIn: true,
        checkOut: true,
      },
    });

    const confirmedRevenue = bookings.reduce(
      (sum, b) => sum + toNumber(b.netAmount),
      0
    );

    const confirmedNights = bookings.reduce((sum, b) => {
      try {
        return sum + calcNights(new Date(b.checkIn), new Date(b.checkOut));
      } catch {
        return sum;
      }
    }, 0);

    // Projected revenue — try same calendar month last year first
    const calendarMonth = getMonth(targetMonth) + 1; // 1-12
    const lastYear = getYear(targetMonth) - 1;
    const lastYearMonthStart = new Date(lastYear, calendarMonth - 1, 1);
    const lastYearMonthEnd = endOfMonth(lastYearMonthStart);

    const lastYearBookings = await prisma.booking.findMany({
      where: {
        propertyId,
        deletedAt: null,
        status: {
          in: [
            BookingStatus.CONFIRMED,
            BookingStatus.CHECKED_IN,
            BookingStatus.CHECKED_OUT,
          ],
        },
        OR: [
          { checkIn: { gte: lastYearMonthStart, lte: lastYearMonthEnd } },
          { checkOut: { gte: lastYearMonthStart, lte: lastYearMonthEnd } },
        ],
      },
      select: { netAmount: true },
    });

    let projectedRevenue: number;
    if (lastYearBookings.length > 0) {
      projectedRevenue = lastYearBookings.reduce(
        (sum, b) => sum + toNumber(b.netAmount),
        0
      );
    } else {
      // Fall back to last 90 days avg scaled to month length
      const last90End = subDays(today, 1);
      const last90Start = subDays(last90End, 89);

      const last90Bookings = await prisma.booking.findMany({
        where: {
          propertyId,
          deletedAt: null,
          status: {
            in: [
              BookingStatus.CONFIRMED,
              BookingStatus.CHECKED_IN,
              BookingStatus.CHECKED_OUT,
            ],
          },
          checkOut: { gte: last90Start, lte: last90End },
        },
        select: { netAmount: true },
      });

      const last90Revenue = last90Bookings.reduce(
        (sum, b) => sum + toNumber(b.netAmount),
        0
      );
      const dailyAvg = last90Revenue / 90;
      projectedRevenue = dailyAvg * daysInMonthCount;
    }

    const totalRoomNights = totalRooms * daysInMonthCount;
    const projectedOccupancy =
      totalRoomNights > 0 ? confirmedNights / totalRoomNights : 0;

    result.push({
      period,
      confirmedRevenue: round2(confirmedRevenue),
      projectedRevenue: round2(projectedRevenue),
      totalRooms,
      confirmedNights,
      projectedOccupancy: round2(projectedOccupancy),
    });
  }

  return result;
}

// ─────────────────────────────────────────────
// 3. OCCUPANCY FORECAST
// ─────────────────────────────────────────────

export async function getOccupancyForecast(
  propertyId: string,
  months: number
): Promise<OccupancyForecastMonth[]> {
  const today = new Date();
  const totalRooms = await getTotalRooms(propertyId);

  const result: OccupancyForecastMonth[] = [];

  for (let m = 0; m < months; m++) {
    const targetMonth = addMonths(today, m);
    const period = format(targetMonth, "yyyy-MM");
    const monthStart = startOfMonth(targetMonth);
    const monthEnd = endOfMonth(targetMonth);
    const daysInMonthCount = getDaysInMonth(targetMonth);
    const totalRoomNights = totalRooms * daysInMonthCount;

    // Confirmed bookings in the window
    const bookings = await prisma.booking.findMany({
      where: {
        propertyId,
        deletedAt: null,
        status: {
          in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN],
        },
        OR: [
          { checkIn: { gte: monthStart, lte: monthEnd } },
          { checkOut: { gte: monthStart, lte: monthEnd } },
          { checkIn: { lte: monthStart }, checkOut: { gte: monthEnd } },
        ],
      },
      select: { checkIn: true, checkOut: true },
    });

    const confirmedNights = bookings.reduce((sum, b) => {
      try {
        return sum + calcNights(new Date(b.checkIn), new Date(b.checkOut));
      } catch {
        return sum;
      }
    }, 0);

    // Historical fill rate for same calendar month (last year)
    const calendarMonth = getMonth(targetMonth) + 1;
    const lastYear = getYear(targetMonth) - 1;
    const lastYearMonthStart = new Date(lastYear, calendarMonth - 1, 1);
    const lastYearMonthEnd = endOfMonth(lastYearMonthStart);
    const lastYearDays = getDaysInMonth(lastYearMonthStart);
    const lastYearTotalNights = totalRooms * lastYearDays;

    const lastYearBookings = await prisma.booking.findMany({
      where: {
        propertyId,
        deletedAt: null,
        status: {
          in: [
            BookingStatus.CONFIRMED,
            BookingStatus.CHECKED_IN,
            BookingStatus.CHECKED_OUT,
          ],
        },
        OR: [
          { checkIn: { gte: lastYearMonthStart, lte: lastYearMonthEnd } },
          { checkOut: { gte: lastYearMonthStart, lte: lastYearMonthEnd } },
        ],
      },
      select: { checkIn: true, checkOut: true },
    });

    const lastYearNights = lastYearBookings.reduce((sum, b) => {
      try {
        return sum + calcNights(new Date(b.checkIn), new Date(b.checkOut));
      } catch {
        return sum;
      }
    }, 0);

    const historicalFillRate =
      lastYearTotalNights > 0 ? lastYearNights / lastYearTotalNights : 0;

    const remainingNights = Math.max(0, totalRoomNights - confirmedNights);
    const projectedNights = Math.round(historicalFillRate * remainingNights);

    const confirmedOccupancy =
      totalRoomNights > 0 ? confirmedNights / totalRoomNights : 0;
    const projectedOccupancy =
      totalRoomNights > 0
        ? (confirmedNights + projectedNights) / totalRoomNights
        : 0;

    result.push({
      period,
      totalRoomNights,
      confirmedNights,
      projectedNights,
      confirmedOccupancy: round2(confirmedOccupancy),
      projectedOccupancy: round2(projectedOccupancy),
    });
  }

  return result;
}

// ─────────────────────────────────────────────
// 4. EXPENSE FORECAST
// ─────────────────────────────────────────────

const FIXED_CATEGORIES = ["SALARIES", "LINEN", "CLEANING"];
const VARIABLE_CATEGORIES = ["UTILITIES", "FB"];
const ONEOFF_CATEGORIES = ["MAINTENANCE"];

export async function getExpenseForecast(
  propertyId: string,
  period: string // YYYY-MM
): Promise<ExpenseForecastCategory[]> {
  const [year, month] = period.split("-").map(Number);
  const targetMonthStart = new Date(year, month - 1, 1);
  const targetMonthEnd = endOfMonth(targetMonthStart);

  // Last 90 days of expenses
  const last90End = subDays(new Date(), 1);
  const last90Start = subDays(last90End, 89);

  const expenses = await prisma.transaction.findMany({
    where: {
      propertyId,
      type: TransactionType.EXPENSE,
      deletedAt: null,
      date: { gte: last90Start, lte: last90End },
    },
    select: { category: true, amount: true },
  });

  // Group by category
  const categoryTotals = new Map<string, number>();
  for (const tx of expenses) {
    const cat = tx.category;
    categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + toNumber(tx.amount));
  }

  // Get projected occupancy for the target month
  const occupancyData = await getOccupancyForecast(propertyId, 3);
  const monthOccupancy = occupancyData.find((o) => o.period === period);
  const projectedOcc = monthOccupancy?.projectedOccupancy ?? 0.5;

  // Historical avg occupancy over last 90 days
  const last90TotalRooms = await getTotalRooms(propertyId);
  const last90BookingsCount = await prisma.booking.count({
    where: {
      propertyId,
      deletedAt: null,
      status: {
        in: [
          BookingStatus.CONFIRMED,
          BookingStatus.CHECKED_IN,
          BookingStatus.CHECKED_OUT,
        ],
      },
      checkOut: { gte: last90Start, lte: last90End },
    },
  });
  const histOccupancy = last90TotalRooms > 0
    ? Math.min(1, last90BookingsCount / (last90TotalRooms * 90))
    : 0.5;

  const daysInTargetMonth = getDaysInMonth(targetMonthStart);

  const result: ExpenseForecastCategory[] = [];

  // All categories we have data for
  const allCategories = Array.from(categoryTotals.keys());

  for (const cat of allCategories) {
    const total90 = categoryTotals.get(cat) ?? 0;
    const dailyAvg = total90 / 90;
    const monthlyAvg = dailyAvg * daysInTargetMonth;

    let projectedAmount: number;
    let confidence: "HIGH" | "MEDIUM" | "LOW";

    if (FIXED_CATEGORIES.includes(cat)) {
      projectedAmount = monthlyAvg;
      confidence = "HIGH";
    } else if (VARIABLE_CATEGORIES.includes(cat)) {
      const scaleFactor = histOccupancy > 0 ? projectedOcc / histOccupancy : 1;
      projectedAmount = monthlyAvg * scaleFactor;
      confidence = "MEDIUM";
    } else if (ONEOFF_CATEGORIES.includes(cat)) {
      projectedAmount = monthlyAvg;
      confidence = "LOW";
    } else {
      projectedAmount = monthlyAvg;
      confidence = "MEDIUM";
    }

    result.push({
      category: cat,
      historicalAvg: round2(monthlyAvg),
      projectedAmount: round2(projectedAmount),
      confidence,
    });
  }

  return result;
}

// ─────────────────────────────────────────────
// 5. BREAK-EVEN RATE
// ─────────────────────────────────────────────

export async function getBreakEvenRate(
  propertyId: string,
  period: string
): Promise<BreakEvenResult> {
  const expenseForecast = await getExpenseForecast(propertyId, period);
  const totalProjectedExpenses = expenseForecast.reduce(
    (sum, e) => sum + e.projectedAmount,
    0
  );

  const occupancyData = await getOccupancyForecast(propertyId, 3);
  const [year, month] = period.split("-").map(Number);
  const targetMonthStart = new Date(year, month - 1, 1);
  const monthPeriod = format(targetMonthStart, "yyyy-MM");
  const monthOcc = occupancyData.find((o) => o.period === monthPeriod);
  const projectedOccupiedNights =
    (monthOcc?.confirmedNights ?? 0) + (monthOcc?.projectedNights ?? 0);

  const breakEvenADR =
    projectedOccupiedNights > 0
      ? totalProjectedExpenses / projectedOccupiedNights
      : 0;

  // Current ADR from last 30 days
  const last30End = new Date();
  const last30Start = subDays(last30End, 30);

  const recentBookings = await prisma.booking.findMany({
    where: {
      propertyId,
      deletedAt: null,
      status: {
        in: [
          BookingStatus.CONFIRMED,
          BookingStatus.CHECKED_IN,
          BookingStatus.CHECKED_OUT,
        ],
      },
      checkOut: { gte: last30Start, lte: last30End },
    },
    select: { netAmount: true, checkIn: true, checkOut: true },
  });

  const recentRevenue = recentBookings.reduce(
    (sum, b) => sum + toNumber(b.netAmount),
    0
  );
  const recentNights = recentBookings.reduce((sum, b) => {
    try {
      return sum + calcNights(new Date(b.checkIn), new Date(b.checkOut));
    } catch {
      return sum;
    }
  }, 0);

  const currentADR = recentNights > 0 ? recentRevenue / recentNights : 0;

  return {
    breakEvenADR: round2(breakEvenADR),
    currentADR: round2(currentADR),
    isAboveBreakEven: currentADR >= breakEvenADR,
    gap: round2(currentADR - breakEvenADR),
  };
}

// ─────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
