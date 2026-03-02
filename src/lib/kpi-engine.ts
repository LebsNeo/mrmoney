/**
 * MrCA — KPI Engine
 * Phase 6: RevPAR trends, ADR tracking, occupancy patterns, period-over-period
 */

import { prisma } from "@/lib/prisma";
import { calcOccupancyRate, calcADR, calcRevPAR, calcNights } from "@/lib/kpi";
import { toNumber } from "@/lib/utils";
import {
  startOfMonth,
  endOfMonth,
  getDaysInMonth,
  subMonths,
  subYears,
  format,
  parseISO,
  eachDayOfInterval,
  getDay,
  addDays,
} from "date-fns";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface KPIMetric {
  value: number;
  previousValue: number | null;
  changePercent: number | null;
  trend: "UP" | "DOWN" | "FLAT";
}

export interface MonthlyKPISnapshot {
  period: string; // YYYY-MM
  occupancyRate: KPIMetric;
  ADR: KPIMetric;
  RevPAR: KPIMetric;
  totalRevenue: KPIMetric;
  totalExpenses: KPIMetric;
  netProfit: KPIMetric;
  totalBookings: KPIMetric;
  avgLengthOfStay: KPIMetric;
  cancellationRate: KPIMetric;
}

export interface RoomTypeBreakdown {
  roomType: string;
  bookings: number;
  revenue: number;
  occupiedNights: number;
  adr: number;
}

export interface SourceBreakdown {
  source: string;
  bookings: number;
  revenue: number;
  avgCommission: number;
}

export interface DayOfWeekStats {
  dayName: string;
  bookings: number;
  revenue: number;
}

export interface KPISummary {
  period: string;
  totalRooms: number;
  occupancyRate: number;
  ADR: number;
  RevPAR: number;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  totalBookings: number;
  avgLengthOfStay: number;
  cancellationRate: number;
  byRoomType: RoomTypeBreakdown[];
  bySource: SourceBreakdown[];
  bestDayOfWeek: DayOfWeekStats;
}

export interface OccupancyDay {
  date: string; // YYYY-MM-DD
  occupiedRooms: number;
  totalRooms: number;
  occupancyRate: number;
  revenue: number;
}

export interface RevenueLeakageReport {
  period: string;
  expectedRevenue: number;
  actualRevenue: number;
  totalOTACommissions: number;
  unmatchedPayoutItems: number;
  unmatchedPayoutTotal: number;
  cancellationLoss: number;
  totalLeakage: number;
  leakagePercent: number;
}

export interface BenchmarkKPI {
  kpi: string;
  currentValue: number;
  lastYearValue: number | null;
  threeMonthAvg: number | null;
  vsLastYear: "IMPROVING" | "DECLINING" | "STABLE" | "N/A";
  vs3MAvg: "IMPROVING" | "DECLINING" | "STABLE" | "N/A";
  isBestEver: boolean;
  bestEverValue: number | null;
}

export interface PerformanceBenchmarks {
  period: string;
  benchmarks: BenchmarkKPI[];
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function periodBounds(period: string) {
  const date = parseISO(`${period}-01`);
  return {
    start: startOfMonth(date),
    end: endOfMonth(date),
    daysInMonth: getDaysInMonth(date),
  };
}

function computeMetric(value: number, previousValue: number | null): KPIMetric {
  if (previousValue === null) {
    return { value, previousValue: null, changePercent: null, trend: "FLAT" };
  }
  const diff = value - previousValue;
  const changePercent =
    previousValue === 0
      ? value === 0
        ? 0
        : 100
      : (diff / Math.abs(previousValue)) * 100;
  const rounded = Math.round(changePercent * 100) / 100;
  const trend =
    Math.abs(rounded) < 0.5 ? "FLAT" : rounded > 0 ? "UP" : "DOWN";
  return { value, previousValue, changePercent: rounded, trend };
}

async function getTotalRooms(propertyId: string): Promise<number> {
  const count = await prisma.room.count({
    where: { propertyId, deletedAt: null, status: "ACTIVE" },
  });
  return count;
}

/** Bookings that overlap a period (for occupancy/revenue) */
async function getOverlappingBookings(
  propertyId: string,
  start: Date,
  end: Date,
  statusFilter?: string[]
) {
  return prisma.booking.findMany({
    where: {
      propertyId,
      deletedAt: null,
      ...(statusFilter ? { status: { in: statusFilter as any } } : {}),
      checkIn: { lte: end },
      checkOut: { gt: start },
    },
    include: { room: { select: { type: true } } },
  });
}

/** Bookings where checkIn falls within the period (for booking counts) */
async function getPeriodBookings(
  propertyId: string,
  start: Date,
  end: Date
) {
  return prisma.booking.findMany({
    where: {
      propertyId,
      deletedAt: null,
      checkIn: { gte: start, lte: end },
    },
    include: { room: { select: { type: true } } },
  });
}

async function getPeriodExpenses(
  propertyId: string,
  start: Date,
  end: Date
): Promise<number> {
  const agg = await prisma.transaction.aggregate({
    where: {
      propertyId,
      deletedAt: null,
      type: "EXPENSE",
      date: { gte: start, lte: end },
    },
    _sum: { amount: true },
  });
  return toNumber(agg._sum.amount ?? 0);
}

async function getPeriodIncome(
  propertyId: string,
  start: Date,
  end: Date
): Promise<number> {
  const agg = await prisma.transaction.aggregate({
    where: {
      propertyId,
      deletedAt: null,
      type: "INCOME",
      status: { in: ["CLEARED", "RECONCILED"] },
      date: { gte: start, lte: end },
    },
    _sum: { amount: true },
  });
  return toNumber(agg._sum.amount ?? 0);
}

interface RawKPIValues {
  occupancyRate: number;
  ADR: number;
  RevPAR: number;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  totalBookings: number;
  avgLengthOfStay: number;
  cancellationRate: number;
}

async function computeRawKPIs(
  propertyId: string,
  period: string
): Promise<RawKPIValues> {
  const { start, end, daysInMonth } = periodBounds(period);
  const totalRooms = await getTotalRooms(propertyId);

  // All bookings overlapping this period (for occupancy/revenue)
  const overlapping = await getOverlappingBookings(propertyId, start, end, [
    "CONFIRMED",
    "CHECKED_IN",
    "CHECKED_OUT",
  ]);

  // Compute occupied room-nights (clipped to month)
  let occupiedNights = 0;
  let totalRevenue = 0;

  for (const b of overlapping) {
    const bIn = new Date(b.checkIn);
    const bOut = new Date(b.checkOut);
    // Clip to month
    const clampedIn = bIn < start ? start : bIn;
    const clampedOut = bOut > addDays(end, 1) ? addDays(end, 1) : bOut;
    const clampedNights = Math.max(
      0,
      Math.round(
        (clampedOut.getTime() - clampedIn.getTime()) / (1000 * 60 * 60 * 24)
      )
    );

    let totalNights = 0;
    try {
      totalNights = calcNights(bIn, bOut);
    } catch {
      continue;
    }

    occupiedNights += clampedNights;

    // Prorate revenue to this month's nights
    const prorated =
      totalNights > 0
        ? (toNumber(b.netAmount) * clampedNights) / totalNights
        : 0;
    totalRevenue += prorated;
  }

  const occupancyRate = calcOccupancyRate(occupiedNights, totalRooms, daysInMonth);
  const ADR = calcADR(totalRevenue, occupiedNights);
  const RevPAR = calcRevPAR(totalRevenue, totalRooms, daysInMonth);

  // Bookings with checkIn in this period (for counts / avg stay / cancellation)
  const periodBkgs = await getPeriodBookings(propertyId, start, end);
  const totalBookings = periodBkgs.length;

  const confirmedOrCompleted = periodBkgs.filter((b) =>
    ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"].includes(b.status)
  );
  const cancelled = periodBkgs.filter((b) => b.status === "CANCELLED");
  const cancellationRate =
    totalBookings > 0 ? cancelled.length / totalBookings : 0;

  let totalNightsSum = 0;
  let stayCount = 0;
  for (const b of confirmedOrCompleted) {
    try {
      const n = calcNights(new Date(b.checkIn), new Date(b.checkOut));
      totalNightsSum += n;
      stayCount++;
    } catch {}
  }
  const avgLengthOfStay = stayCount > 0 ? totalNightsSum / stayCount : 0;

  const totalExpenses = await getPeriodExpenses(propertyId, start, end);

  // If no bookings exist, use cleared income transactions as revenue proxy
  // so Revenue and Net Profit show real numbers from bank data
  let effectiveRevenue = totalRevenue;
  if (overlapping.length === 0) {
    const txIncome = await getPeriodIncome(propertyId, start, end);
    if (txIncome > 0) effectiveRevenue = txIncome;
  }

  const netProfit = effectiveRevenue - totalExpenses;

  return {
    occupancyRate,
    ADR,
    RevPAR,
    totalRevenue: effectiveRevenue,
    totalExpenses,
    netProfit,
    totalBookings,
    avgLengthOfStay: Math.round(avgLengthOfStay * 100) / 100,
    cancellationRate: Math.round(cancellationRate * 10000) / 10000,
  };
}

// ─────────────────────────────────────────────
// PUBLIC FUNCTIONS
// ─────────────────────────────────────────────

/**
 * Returns monthly KPI snapshots for the last N months, each compared to the previous month.
 */
export async function getKPITrends(
  propertyId: string,
  months: number
): Promise<MonthlyKPISnapshot[]> {
  const now = new Date();
  // Fetch N+1 periods so we can compute change for the first period too
  const periods: string[] = [];
  for (let i = months; i >= 0; i--) {
    periods.push(format(subMonths(now, i), "yyyy-MM"));
  }

  // Compute raw KPIs for all periods in parallel
  const rawResults = await Promise.all(
    periods.map((p) => computeRawKPIs(propertyId, p))
  );

  // Build snapshots (skip the extra "previous" period at index 0)
  const snapshots: MonthlyKPISnapshot[] = [];
  for (let i = 1; i < rawResults.length; i++) {
    const curr = rawResults[i];
    const prev = rawResults[i - 1];

    snapshots.push({
      period: periods[i],
      occupancyRate: computeMetric(curr.occupancyRate, prev.occupancyRate),
      ADR: computeMetric(curr.ADR, prev.ADR),
      RevPAR: computeMetric(curr.RevPAR, prev.RevPAR),
      totalRevenue: computeMetric(curr.totalRevenue, prev.totalRevenue),
      totalExpenses: computeMetric(curr.totalExpenses, prev.totalExpenses),
      netProfit: computeMetric(curr.netProfit, prev.netProfit),
      totalBookings: computeMetric(curr.totalBookings, prev.totalBookings),
      avgLengthOfStay: computeMetric(curr.avgLengthOfStay, prev.avgLengthOfStay),
      cancellationRate: computeMetric(curr.cancellationRate, prev.cancellationRate),
    });
  }

  return snapshots;
}

/**
 * Deep-dive KPIs for a single month, including breakdowns.
 */
export async function getKPISummary(
  propertyId: string,
  period: string
): Promise<KPISummary> {
  const { start, end, daysInMonth } = periodBounds(period);
  const totalRooms = await getTotalRooms(propertyId);
  const raw = await computeRawKPIs(propertyId, period);

  // All overlapping bookings for breakdown analysis
  const bookings = await getOverlappingBookings(propertyId, start, end, [
    "CONFIRMED",
    "CHECKED_IN",
    "CHECKED_OUT",
  ]);

  // ─── By Room Type ───
  const roomTypeMap = new Map<
    string,
    { bookings: number; revenue: number; nights: number }
  >();
  for (const b of bookings) {
    const rt = b.room.type as string;
    const existing = roomTypeMap.get(rt) ?? { bookings: 0, revenue: 0, nights: 0 };
    const bIn = new Date(b.checkIn);
    const bOut = new Date(b.checkOut);
    const clampedIn = bIn < start ? start : bIn;
    const clampedOut = bOut > addDays(end, 1) ? addDays(end, 1) : bOut;
    const clampedNights = Math.max(
      0,
      Math.round((clampedOut.getTime() - clampedIn.getTime()) / 86400000)
    );
    let totalNights = 0;
    try { totalNights = calcNights(bIn, bOut); } catch {}
    const prorated = totalNights > 0 ? (toNumber(b.netAmount) * clampedNights) / totalNights : 0;
    roomTypeMap.set(rt, {
      bookings: existing.bookings + 1,
      revenue: existing.revenue + prorated,
      nights: existing.nights + clampedNights,
    });
  }
  const byRoomType: RoomTypeBreakdown[] = Array.from(roomTypeMap.entries()).map(
    ([roomType, data]) => ({
      roomType,
      bookings: data.bookings,
      revenue: Math.round(data.revenue * 100) / 100,
      occupiedNights: data.nights,
      adr: calcADR(data.revenue, data.nights),
    })
  );

  // ─── By Source ───
  const sourceMap = new Map<
    string,
    { bookings: number; revenue: number; commission: number }
  >();
  for (const b of bookings) {
    const src = b.source as string;
    const existing = sourceMap.get(src) ?? { bookings: 0, revenue: 0, commission: 0 };
    const bIn = new Date(b.checkIn);
    const bOut = new Date(b.checkOut);
    const clampedIn = bIn < start ? start : bIn;
    const clampedOut = bOut > addDays(end, 1) ? addDays(end, 1) : bOut;
    const clampedNights = Math.max(
      0,
      Math.round((clampedOut.getTime() - clampedIn.getTime()) / 86400000)
    );
    let totalNights = 0;
    try { totalNights = calcNights(bIn, bOut); } catch {}
    const prorated = totalNights > 0 ? (toNumber(b.netAmount) * clampedNights) / totalNights : 0;
    const commissionProrated = totalNights > 0
      ? (toNumber(b.otaCommission) * clampedNights) / totalNights
      : 0;
    sourceMap.set(src, {
      bookings: existing.bookings + 1,
      revenue: existing.revenue + prorated,
      commission: existing.commission + commissionProrated,
    });
  }
  const bySource: SourceBreakdown[] = Array.from(sourceMap.entries()).map(
    ([source, data]) => ({
      source,
      bookings: data.bookings,
      revenue: Math.round(data.revenue * 100) / 100,
      avgCommission:
        data.bookings > 0
          ? Math.round((data.commission / data.bookings) * 100) / 100
          : 0,
    })
  );

  // ─── Best Day of Week ───
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dowMap = new Map<number, { bookings: number; revenue: number }>();
  for (const b of bookings) {
    const bIn = new Date(b.checkIn);
    const dayIndex = getDay(bIn);
    const existing = dowMap.get(dayIndex) ?? { bookings: 0, revenue: 0 };
    dowMap.set(dayIndex, {
      bookings: existing.bookings + 1,
      revenue: existing.revenue + toNumber(b.netAmount),
    });
  }
  let bestDay = { dayName: "Monday", bookings: 0, revenue: 0 };
  for (const [dayIndex, data] of dowMap.entries()) {
    if (data.revenue > bestDay.revenue) {
      bestDay = { dayName: dayNames[dayIndex], ...data };
    }
  }

  return {
    period,
    totalRooms,
    occupancyRate: raw.occupancyRate,
    ADR: raw.ADR,
    RevPAR: raw.RevPAR,
    totalRevenue: raw.totalRevenue,
    totalExpenses: raw.totalExpenses,
    netProfit: raw.netProfit,
    totalBookings: raw.totalBookings,
    avgLengthOfStay: raw.avgLengthOfStay,
    cancellationRate: raw.cancellationRate,
    byRoomType,
    bySource,
    bestDayOfWeek: bestDay,
  };
}

/**
 * Day-by-day occupancy for a month — used to render a calendar heatmap.
 */
export async function getOccupancyCalendar(
  propertyId: string,
  month: string
): Promise<OccupancyDay[]> {
  const { start, end } = periodBounds(month);
  const totalRooms = await getTotalRooms(propertyId);

  // All overlapping non-cancelled bookings
  const bookings = await getOverlappingBookings(propertyId, start, end, [
    "CONFIRMED",
    "CHECKED_IN",
    "CHECKED_OUT",
  ]);

  const days = eachDayOfInterval({ start, end });

  return days.map((day) => {
    const dayEnd = addDays(day, 1);
    // Bookings that occupy this day: checkIn <= day AND checkOut > day
    const dayBookings = bookings.filter((b) => {
      const bIn = new Date(b.checkIn);
      const bOut = new Date(b.checkOut);
      return bIn <= day && bOut > day;
    });

    const occupiedRooms = dayBookings.length;
    const occupancyRate =
      totalRooms > 0 ? occupiedRooms / totalRooms : 0;

    // Revenue: prorate each booking's netAmount to this single day
    let revenue = 0;
    for (const b of dayBookings) {
      let nights = 0;
      try {
        nights = calcNights(new Date(b.checkIn), new Date(b.checkOut));
      } catch {
        continue;
      }
      revenue += nights > 0 ? toNumber(b.netAmount) / nights : 0;
    }

    return {
      date: format(day, "yyyy-MM-dd"),
      occupiedRooms,
      totalRooms,
      occupancyRate: Math.round(occupancyRate * 10000) / 10000,
      revenue: Math.round(revenue * 100) / 100,
    };
  });
}

/**
 * Revenue leakage analysis: expected vs actual, OTA commissions, unmatched payouts.
 */
export async function getRevenueLeakageReport(
  propertyId: string,
  period: string
): Promise<RevenueLeakageReport> {
  const { start, end } = periodBounds(period);

  // Expected: netAmount from CHECKED_OUT bookings with checkOut in period
  const checkedOut = await prisma.booking.findMany({
    where: {
      propertyId,
      deletedAt: null,
      status: "CHECKED_OUT",
      checkOut: { gte: start, lte: end },
    },
  });
  const expectedRevenue = checkedOut.reduce(
    (sum, b) => sum + toNumber(b.netAmount),
    0
  );
  const totalOTACommissions = checkedOut.reduce(
    (sum, b) => sum + toNumber(b.otaCommission),
    0
  );

  // Actual: INCOME transactions (CLEARED + RECONCILED) in period
  const actualRevenue = await getPeriodIncome(propertyId, start, end);

  // Unmatched OTA payout items — look at OTAPayoutItems linked to payouts for this property in this period
  const unmatchedItems = await prisma.oTAPayoutItem.findMany({
    where: {
      deletedAt: null,
      isMatched: false,
      payout: {
        propertyId,
        deletedAt: null,
        OR: [
          { periodStart: { gte: start, lte: end } },
          { periodEnd: { gte: start, lte: end } },
        ],
      },
    },
  });
  const unmatchedPayoutTotal = unmatchedItems.reduce(
    (sum, item) => sum + toNumber(item.netAmount),
    0
  );

  // Cancellation loss: grossAmount from CANCELLED bookings with checkIn in period
  const cancelled = await prisma.booking.findMany({
    where: {
      propertyId,
      deletedAt: null,
      status: "CANCELLED",
      checkIn: { gte: start, lte: end },
    },
  });
  const cancellationLoss = cancelled.reduce(
    (sum, b) => sum + toNumber(b.netAmount),
    0
  );

  const totalLeakage = Math.max(0, expectedRevenue - actualRevenue);
  const leakagePercent =
    expectedRevenue > 0
      ? Math.round((totalLeakage / expectedRevenue) * 10000) / 100
      : 0;

  return {
    period,
    expectedRevenue: Math.round(expectedRevenue * 100) / 100,
    actualRevenue: Math.round(actualRevenue * 100) / 100,
    totalOTACommissions: Math.round(totalOTACommissions * 100) / 100,
    unmatchedPayoutItems: unmatchedItems.length,
    unmatchedPayoutTotal: Math.round(unmatchedPayoutTotal * 100) / 100,
    cancellationLoss: Math.round(cancellationLoss * 100) / 100,
    totalLeakage: Math.round(totalLeakage * 100) / 100,
    leakagePercent,
  };
}

/**
 * Performance benchmarks: current vs same period last year, vs 3-month avg, and "best ever".
 */
export async function getPerformanceBenchmarks(
  propertyId: string,
  period: string
): Promise<PerformanceBenchmarks> {
  const now = parseISO(`${period}-01`);

  const lastYearPeriod = format(subYears(now, 1), "yyyy-MM");
  const threeMonthsPeriods = [
    format(subMonths(now, 1), "yyyy-MM"),
    format(subMonths(now, 2), "yyyy-MM"),
    format(subMonths(now, 3), "yyyy-MM"),
  ];

  // Fetch current, last year, and last 3 months in parallel
  const [current, lastYear, ...threePast] = await Promise.all([
    computeRawKPIs(propertyId, period),
    computeRawKPIs(propertyId, lastYearPeriod),
    ...threeMonthsPeriods.map((p) => computeRawKPIs(propertyId, p)),
  ]);

  function avg3M(key: keyof RawKPIValues): number {
    const vals = threePast.map((p) => p[key] as number);
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  }

  // Fetch all historical periods to detect "best ever"
  // Use the last 36 months as "all history" (pragmatic)
  const historicalPeriods: string[] = [];
  for (let i = 1; i <= 36; i++) {
    historicalPeriods.push(format(subMonths(now, i), "yyyy-MM"));
  }
  // Only fetch if we have real data (skip if no bookings exist)
  const historicalRaw = await Promise.all(
    historicalPeriods.map((p) => computeRawKPIs(propertyId, p))
  );

  function isBestEver(key: keyof RawKPIValues, currentVal: number): { isBest: boolean; bestEver: number } {
    const allVals = historicalRaw.map((r) => r[key] as number);
    const maxHistorical = Math.max(...allVals, 0);
    return {
      isBest: currentVal > 0 && currentVal >= maxHistorical,
      bestEver: Math.max(currentVal, maxHistorical),
    };
  }

  function compareStatus(
    currentVal: number,
    benchVal: number | null
  ): "IMPROVING" | "DECLINING" | "STABLE" | "N/A" {
    if (benchVal === null) return "N/A";
    const diff = benchVal === 0 ? 0 : ((currentVal - benchVal) / Math.abs(benchVal)) * 100;
    if (diff > 2) return "IMPROVING";
    if (diff < -2) return "DECLINING";
    return "STABLE";
  }

  const kpiKeys: Array<{ key: keyof RawKPIValues; label: string }> = [
    { key: "occupancyRate", label: "Occupancy Rate" },
    { key: "ADR", label: "ADR" },
    { key: "RevPAR", label: "RevPAR" },
    { key: "totalRevenue", label: "Total Revenue" },
    { key: "netProfit", label: "Net Profit" },
    { key: "avgLengthOfStay", label: "Avg Length of Stay" },
    { key: "cancellationRate", label: "Cancellation Rate" },
  ];

  const benchmarks: BenchmarkKPI[] = kpiKeys.map(({ key, label }) => {
    const currentVal = current[key] as number;
    const lastYearVal = lastYear[key] as number;
    const threeMonthAvg = avg3M(key);
    const { isBest, bestEver } = isBestEver(key, currentVal);

    // For cancellationRate: lower is better — flip the comparison
    const isLowerBetter = key === "cancellationRate" || key === "totalExpenses";
    const adjustedCompare = (cv: number, bv: number | null): ReturnType<typeof compareStatus> => {
      if (bv === null) return "N/A";
      const raw = compareStatus(cv, bv);
      if (!isLowerBetter) return raw;
      // Flip for lower-is-better metrics
      if (raw === "IMPROVING") return "DECLINING";
      if (raw === "DECLINING") return "IMPROVING";
      return raw;
    };

    return {
      kpi: label,
      currentValue: currentVal,
      lastYearValue: lastYearVal,
      threeMonthAvg,
      vsLastYear: adjustedCompare(currentVal, lastYearVal),
      vs3MAvg: adjustedCompare(currentVal, threeMonthAvg),
      isBestEver: isBest,
      bestEverValue: bestEver > 0 ? bestEver : null,
    };
  });

  return { period, benchmarks };
}
