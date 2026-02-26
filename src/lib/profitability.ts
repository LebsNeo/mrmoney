/**
 * MrMoney — Phase 5: Profitability Intelligence Engine
 *
 * All monetary values in ZAR (or property currency).
 * Period format: "YYYY-MM"
 */

import { prisma } from "@/lib/prisma";
import { calcNights } from "@/lib/kpi";
import { toNumber } from "@/lib/utils";
import { parse, startOfMonth, endOfMonth, differenceInCalendarDays, subMonths } from "date-fns";

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function parsePeriod(period: string): { start: Date; end: Date; days: number } {
  const base = parse(period, "yyyy-MM", new Date());
  const start = startOfMonth(base);
  const end = endOfMonth(base);
  const days = differenceInCalendarDays(end, start) + 1;
  return { start, end, days };
}

function round(v: number, d = 2) {
  return Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
}

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface RoomProfitability {
  roomId: string;
  roomName: string;
  roomType: string;
  revenue: number;
  directCosts: number;
  allocatedOverhead: number;
  totalCosts: number;
  netProfit: number;
  profitMargin: number;
  occupancyRate: number;
  occupiedNights: number;
  availableNights: number;
  revenuePerAvailableNight: number;
  rank: number;
}

export interface SourceProfitability {
  source: string;
  bookingCount: number;
  grossRevenue: number;
  totalCommission: number;
  netRevenue: number;
  avgBookingValue: number;
  avgNights: number;
  netMargin: number;
}

export interface DepartmentCost {
  departmentId: string;
  departmentName: string;
  totalCosts: number;
  costPerOccupiedNight: number;
}

export interface MarginPerNight {
  totalNetRevenue: number;
  totalExpenses: number;
  occupiedNights: number;
  revenuePerOccupiedNight: number;
  costPerOccupiedNight: number;
  netMarginPerNight: number;
}

export interface CostBreakdown {
  fixed: number;
  variable: number;
  oneOff: number;
  total: number;
  fixedPercent: number;
  variablePercent: number;
  oneOffPercent: number;
}

// ─────────────────────────────────────────────
// 1. ROOM PROFITABILITY
// ─────────────────────────────────────────────

export async function getProfitabilityByRoom(
  propertyId: string,
  period: string
): Promise<RoomProfitability[]> {
  const { start, end, days } = parsePeriod(period);

  // All active rooms
  const rooms = await prisma.room.findMany({
    where: { propertyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true, type: true },
  });

  const totalActiveRooms = rooms.length;
  if (totalActiveRooms === 0) return [];

  // Bookings per room in period (confirmed/checked_in/checked_out)
  const bookings = await prisma.booking.findMany({
    where: {
      propertyId,
      deletedAt: null,
      status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
      OR: [
        { checkIn: { gte: start, lte: end } },
        { checkOut: { gte: start, lte: end } },
        { checkIn: { lte: start }, checkOut: { gte: end } },
      ],
    },
    include: {
      transactions: {
        where: { deletedAt: null, type: "EXPENSE" },
      },
    },
  });

  // Fixed overhead transactions at property level (not linked to a booking)
  const overheadTx = await prisma.transaction.findMany({
    where: {
      propertyId,
      deletedAt: null,
      type: "EXPENSE",
      category: { in: ["SALARIES", "LAUNDRY", "CLEANING"] },
      date: { gte: start, lte: end },
      bookingId: null,
    },
  });

  const totalOverhead = overheadTx.reduce((s, t) => s + toNumber(t.amount), 0);
  const overheadPerRoom = totalActiveRooms > 0 ? totalOverhead / totalActiveRooms : 0;

  const results: RoomProfitability[] = rooms.map((room) => {
    const roomBookings = bookings.filter((b) => b.roomId === room.id);

    const revenue = roomBookings.reduce((s, b) => s + toNumber(b.netAmount), 0);
    const directCosts = roomBookings.reduce((s, b) => {
      const txSum = b.transactions.reduce((ts, t) => ts + toNumber(t.amount), 0);
      return s + txSum;
    }, 0);
    const allocatedOverhead = overheadPerRoom;
    const totalCosts = directCosts + allocatedOverhead;
    const netProfit = revenue - totalCosts;
    const profitMargin = revenue > 0 ? round(netProfit / revenue, 4) : 0;

    const occupiedNights = roomBookings.reduce((s, b) => {
      try {
        return s + calcNights(new Date(b.checkIn), new Date(b.checkOut));
      } catch {
        return s;
      }
    }, 0);
    const availableNights = days;
    const occupancyRate = availableNights > 0 ? round(occupiedNights / availableNights, 4) : 0;
    const revenuePerAvailableNight = availableNights > 0 ? round(revenue / availableNights) : 0;

    return {
      roomId: room.id,
      roomName: room.name,
      roomType: room.type,
      revenue: round(revenue),
      directCosts: round(directCosts),
      allocatedOverhead: round(allocatedOverhead),
      totalCosts: round(totalCosts),
      netProfit: round(netProfit),
      profitMargin,
      occupancyRate,
      occupiedNights,
      availableNights,
      revenuePerAvailableNight,
      rank: 0,
    };
  });

  // Sort by netProfit descending, assign rank
  results.sort((a, b) => b.netProfit - a.netProfit);
  results.forEach((r, i) => { r.rank = i + 1; });

  return results;
}

// ─────────────────────────────────────────────
// 2. SOURCE PROFITABILITY
// ─────────────────────────────────────────────

export async function getProfitabilityBySource(
  propertyId: string,
  period: string
): Promise<SourceProfitability[]> {
  const { start, end } = parsePeriod(period);

  const bookings = await prisma.booking.findMany({
    where: {
      propertyId,
      deletedAt: null,
      status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
      OR: [
        { checkIn: { gte: start, lte: end } },
        { checkOut: { gte: start, lte: end } },
        { checkIn: { lte: start }, checkOut: { gte: end } },
      ],
    },
  });

  const grouped = new Map<string, typeof bookings>();
  for (const b of bookings) {
    const key = b.source;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(b);
  }

  const results: SourceProfitability[] = [];

  for (const [source, bkgs] of grouped.entries()) {
    const bookingCount = bkgs.length;
    const grossRevenue = bkgs.reduce((s, b) => s + toNumber(b.grossAmount), 0);
    const totalCommission = bkgs.reduce((s, b) => s + toNumber(b.otaCommission), 0);
    const netRevenue = bkgs.reduce((s, b) => s + toNumber(b.netAmount), 0);
    const avgBookingValue = bookingCount > 0 ? round(netRevenue / bookingCount) : 0;

    const totalNights = bkgs.reduce((s, b) => {
      try {
        return s + calcNights(new Date(b.checkIn), new Date(b.checkOut));
      } catch {
        return s;
      }
    }, 0);
    const avgNights = bookingCount > 0 ? round(totalNights / bookingCount) : 0;
    const netMargin = grossRevenue > 0 ? round(netRevenue / grossRevenue, 4) : 0;

    results.push({
      source,
      bookingCount,
      grossRevenue: round(grossRevenue),
      totalCommission: round(totalCommission),
      netRevenue: round(netRevenue),
      avgBookingValue,
      avgNights,
      netMargin,
    });
  }

  results.sort((a, b) => b.netRevenue - a.netRevenue);
  return results;
}

// ─────────────────────────────────────────────
// 3. DEPARTMENT COSTS
// ─────────────────────────────────────────────

export async function getDepartmentCosts(
  propertyId: string,
  period: string
): Promise<DepartmentCost[]> {
  const { start, end } = parsePeriod(period);

  const departments = await prisma.department.findMany({
    where: { propertyId, deletedAt: null },
    select: { id: true, name: true },
  });

  // Occupied nights for this period
  const bookings = await prisma.booking.findMany({
    where: {
      propertyId,
      deletedAt: null,
      status: "CHECKED_OUT",
      OR: [
        { checkIn: { gte: start, lte: end } },
        { checkOut: { gte: start, lte: end } },
        { checkIn: { lte: start }, checkOut: { gte: end } },
      ],
    },
  });
  const occupiedNights = bookings.reduce((s, b) => {
    try { return s + calcNights(new Date(b.checkIn), new Date(b.checkOut)); } catch { return s; }
  }, 0);

  // Group expense transactions by department
  const txByDept = await prisma.transaction.groupBy({
    by: ["departmentId"],
    where: {
      propertyId,
      deletedAt: null,
      type: "EXPENSE",
      date: { gte: start, lte: end },
      departmentId: { not: null },
    },
    _sum: { amount: true },
  });

  const deptMap = new Map(txByDept.map((r) => [r.departmentId, toNumber(r._sum.amount ?? 0)]));

  return departments.map((dept) => {
    const totalCosts = round(deptMap.get(dept.id) ?? 0);
    const costPerOccupiedNight = occupiedNights > 0 ? round(totalCosts / occupiedNights) : 0;
    return { departmentId: dept.id, departmentName: dept.name, totalCosts, costPerOccupiedNight };
  });
}

// ─────────────────────────────────────────────
// 4. MARGIN PER OCCUPIED NIGHT
// ─────────────────────────────────────────────

export async function getMarginPerOccupiedNight(
  propertyId: string,
  period: string
): Promise<MarginPerNight> {
  const { start, end } = parsePeriod(period);

  const [txAgg, bookings] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["type"],
      where: { propertyId, deletedAt: null, date: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    prisma.booking.findMany({
      where: {
        propertyId,
        deletedAt: null,
        status: "CHECKED_OUT",
        OR: [
          { checkIn: { gte: start, lte: end } },
          { checkOut: { gte: start, lte: end } },
          { checkIn: { lte: start }, checkOut: { gte: end } },
        ],
      },
    }),
  ]);

  const totalNetRevenue = toNumber(txAgg.find((r) => r.type === "INCOME")?._sum.amount ?? 0);
  const totalExpenses = toNumber(txAgg.find((r) => r.type === "EXPENSE")?._sum.amount ?? 0);

  const occupiedNights = bookings.reduce((s, b) => {
    try { return s + calcNights(new Date(b.checkIn), new Date(b.checkOut)); } catch { return s; }
  }, 0);

  const revenuePerOccupiedNight = occupiedNights > 0 ? round(totalNetRevenue / occupiedNights) : 0;
  const costPerOccupiedNight = occupiedNights > 0 ? round(totalExpenses / occupiedNights) : 0;
  const netMarginPerNight = round(revenuePerOccupiedNight - costPerOccupiedNight);

  return {
    totalNetRevenue: round(totalNetRevenue),
    totalExpenses: round(totalExpenses),
    occupiedNights,
    revenuePerOccupiedNight,
    costPerOccupiedNight,
    netMarginPerNight,
  };
}

// ─────────────────────────────────────────────
// 5. COST BREAKDOWN
// ─────────────────────────────────────────────

const FIXED_CATEGORIES = ["SALARIES", "CLEANING", "MARKETING"] as const;
const VARIABLE_CATEGORIES = ["UTILITIES", "FB", "LAUNDRY"] as const;
const ONEOFF_CATEGORIES = ["MAINTENANCE", "SUPPLIES", "OTHER"] as const;

export async function getCostBreakdown(
  propertyId: string,
  period: string
): Promise<CostBreakdown> {
  const { start, end } = parsePeriod(period);

  const txAgg = await prisma.transaction.groupBy({
    by: ["category"],
    where: {
      propertyId,
      deletedAt: null,
      type: "EXPENSE",
      date: { gte: start, lte: end },
    },
    _sum: { amount: true },
  });

  const byCategory = new Map(txAgg.map((r) => [r.category, toNumber(r._sum.amount ?? 0)]));

  const fixed = round([...FIXED_CATEGORIES].reduce((s, c) => s + (byCategory.get(c as import("@prisma/client").TransactionCategory) ?? 0), 0));
  const variable = round([...VARIABLE_CATEGORIES].reduce((s, c) => s + (byCategory.get(c as import("@prisma/client").TransactionCategory) ?? 0), 0));
  const oneOff = round([...ONEOFF_CATEGORIES].reduce((s, c) => s + (byCategory.get(c as import("@prisma/client").TransactionCategory) ?? 0), 0));
  const total = round(fixed + variable + oneOff);

  const fixedPercent = total > 0 ? round(fixed / total, 4) : 0;
  const variablePercent = total > 0 ? round(variable / total, 4) : 0;
  const oneOffPercent = total > 0 ? round(oneOff / total, 4) : 0;

  return { fixed, variable, oneOff, total, fixedPercent, variablePercent, oneOffPercent };
}

// ─────────────────────────────────────────────
// 6. PROFITABILITY INSIGHTS
// ─────────────────────────────────────────────

export async function generateProfitabilityInsights(
  propertyId: string,
  period: string
): Promise<string[]> {
  const insights: string[] = [];
  const { start } = parsePeriod(period);

  // Run all analyses in parallel
  const [rooms, sources, margin, prevMargin] = await Promise.all([
    getProfitabilityByRoom(propertyId, period),
    getProfitabilityBySource(propertyId, period),
    getMarginPerOccupiedNight(propertyId, period),
    getMarginPerOccupiedNight(propertyId, format(subMonths(start, 1), "yyyy-MM")),
  ]);

  // Insight 1: Low margin rooms (<20%)
  for (const room of rooms) {
    if (room.revenue > 0 && room.profitMargin < 0.20) {
      const pct = Math.round(room.profitMargin * 100);
      insights.push(`Room ${room.roomName} has a low margin of ${pct}% — review pricing or costs`);
    }
  }

  // Insight 2: OTA commissions > 20% of gross revenue
  const otaSources = sources.filter((s) => s.source !== "DIRECT");
  const totalOTACommission = otaSources.reduce((s, x) => s + x.totalCommission, 0);
  const totalGrossRevenue = sources.reduce((s, x) => s + x.grossRevenue, 0);
  if (totalGrossRevenue > 0 && totalOTACommission / totalGrossRevenue > 0.20) {
    const pct = Math.round((totalOTACommission / totalGrossRevenue) * 100);
    insights.push(
      `OTA commissions cost R${totalOTACommission.toFixed(0)} this period — ${pct}% of gross`
    );
  }

  // Insight 3: DIRECT margin > OTA margin by >20 percentage points
  const directSource = sources.find((s) => s.source === "DIRECT");
  const otaNetRevenue = otaSources.reduce((s, x) => s + x.netRevenue, 0);
  const otaGross = otaSources.reduce((s, x) => s + x.grossRevenue, 0);
  const otaMargin = otaGross > 0 ? otaNetRevenue / otaGross : 0;
  if (directSource && directSource.grossRevenue > 0) {
    const directMargin = directSource.netMargin;
    if (directMargin - otaMargin > 0.20) {
      const multiple = otaMargin > 0 ? round(directMargin / otaMargin) : 0;
      insights.push(`Direct bookings are ${multiple}x more profitable than OTA`);
    }
  }

  // Insight 4: Any room unbooked > 14 days
  const today = new Date();
  for (const room of rooms) {
    if (room.occupiedNights === 0) {
      // Check last booking for this room
      const lastBooking = await prisma.booking.findFirst({
        where: { roomId: room.roomId, deletedAt: null, status: { in: ["CHECKED_OUT", "CONFIRMED", "CHECKED_IN"] } },
        orderBy: { checkOut: "desc" },
        select: { checkOut: true },
      });
      const lastDate = lastBooking ? new Date(lastBooking.checkOut) : null;
      const daysSince = lastDate ? differenceInCalendarDays(today, lastDate) : 999;
      if (daysSince > 14) {
        insights.push(`Room ${room.roomName} has been unbooked for ${daysSince} days`);
      }
    }
  }

  // Insight 5: Cost per occupied night up > 10% vs previous period
  if (
    prevMargin.costPerOccupiedNight > 0 &&
    margin.costPerOccupiedNight > prevMargin.costPerOccupiedNight
  ) {
    const delta = (margin.costPerOccupiedNight - prevMargin.costPerOccupiedNight) / prevMargin.costPerOccupiedNight;
    if (delta > 0.10) {
      const pct = Math.round(delta * 100);
      insights.push(`Cost per occupied night up ${pct}% vs last period`);
    }
  }

  return insights;
}

// Re-export format for internal use
function format(date: Date, fmt: string): string {
  // Simple YYYY-MM formatter — only used internally for period shift
  if (fmt === "yyyy-MM") {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }
  return date.toISOString();
}
