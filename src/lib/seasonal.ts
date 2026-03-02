/**
 * MrCA — Seasonal Analysis
 * Phase 4: Historical pattern analysis for revenue and occupancy
 */

import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { calcNights } from "@/lib/kpi";
import { getDaysInMonth } from "date-fns";
import { BookingStatus } from "@prisma/client";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface SeasonalPattern {
  month: number; // 1-12
  avgOccupancy: number;
  avgRevenue: number;
  avgADR: number;
  dataPoints: number; // number of years of data for this month
}

export interface SeasonalIndex {
  monthNumber: number;
  index: number; // 1.0 = average, 1.3 = 30% above, 0.7 = 30% below
  avgOccupancy: number;
  avgRevenue: number;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

async function getTotalRooms(propertyId: string): Promise<number> {
  return prisma.room.count({
    where: { propertyId, status: "ACTIVE", deletedAt: null },
  });
}

// ─────────────────────────────────────────────
// 1. SEASONAL PATTERN
// ─────────────────────────────────────────────

export async function getSeasonalPattern(
  propertyId: string
): Promise<SeasonalPattern[]> {
  const totalRooms = await getTotalRooms(propertyId);

  // Fetch all historical bookings that are completed (CHECKED_OUT) or confirmed
  const bookings = await prisma.booking.findMany({
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
    },
    select: {
      checkIn: true,
      checkOut: true,
      netAmount: true,
    },
  });

  // Group by year+month, then aggregate per calendar month
  // monthData[month][year] = { revenue, nights }
  const monthYearData: Map<
    number, // month 1-12
    Map<
      number, // year
      { revenue: number; nights: number; totalRoomNights: number }
    >
  > = new Map();

  for (let m = 1; m <= 12; m++) {
    monthYearData.set(m, new Map());
  }

  for (const b of bookings) {
    const checkIn = new Date(b.checkIn);
    const month = checkIn.getMonth() + 1; // 1-12
    const year = checkIn.getFullYear();

    let nights = 0;
    try {
      nights = calcNights(new Date(b.checkIn), new Date(b.checkOut));
    } catch {
      continue;
    }

    const revenue = toNumber(b.netAmount);
    const daysInM = getDaysInMonth(new Date(year, month - 1, 1));
    const totalRoomNights = totalRooms * daysInM;

    const monthMap = monthYearData.get(month)!;
    const existing = monthMap.get(year) ?? {
      revenue: 0,
      nights: 0,
      totalRoomNights,
    };
    existing.revenue += revenue;
    existing.nights += nights;
    monthMap.set(year, existing);
  }

  const patterns: SeasonalPattern[] = [];

  for (let m = 1; m <= 12; m++) {
    const yearMap = monthYearData.get(m)!;
    const dataPoints = yearMap.size;

    if (dataPoints === 0) {
      patterns.push({
        month: m,
        avgOccupancy: 0,
        avgRevenue: 0,
        avgADR: 0,
        dataPoints: 0,
      });
      continue;
    }

    let totalOccupancy = 0;
    let totalRevenue = 0;
    let totalNights = 0;

    for (const { revenue, nights, totalRoomNights } of yearMap.values()) {
      totalOccupancy += totalRoomNights > 0 ? nights / totalRoomNights : 0;
      totalRevenue += revenue;
      totalNights += nights;
    }

    const avgOccupancy = totalOccupancy / dataPoints;
    const avgRevenue = totalRevenue / dataPoints;
    const avgADR = totalNights > 0 ? totalRevenue / totalNights : 0;

    patterns.push({
      month: m,
      avgOccupancy: round2(avgOccupancy),
      avgRevenue: round2(avgRevenue),
      avgADR: round2(avgADR),
      dataPoints,
    });
  }

  return patterns;
}

// ─────────────────────────────────────────────
// 2. SEASONAL INDEX
// ─────────────────────────────────────────────

export async function getSeasonalIndex(
  propertyId: string,
  monthNumber: number
): Promise<SeasonalIndex> {
  const patterns = await getSeasonalPattern(propertyId);

  // Filter months with actual data
  const withData = patterns.filter((p) => p.dataPoints > 0);

  if (withData.length === 0) {
    return {
      monthNumber,
      index: 1.0,
      avgOccupancy: 0,
      avgRevenue: 0,
    };
  }

  // Annual averages
  const annualAvgRevenue =
    withData.reduce((sum, p) => sum + p.avgRevenue, 0) / withData.length;
  const annualAvgOccupancy =
    withData.reduce((sum, p) => sum + p.avgOccupancy, 0) / withData.length;

  const targetPattern = patterns.find((p) => p.month === monthNumber);

  if (!targetPattern || targetPattern.dataPoints === 0) {
    return {
      monthNumber,
      index: 1.0,
      avgOccupancy: annualAvgOccupancy,
      avgRevenue: annualAvgRevenue,
    };
  }

  const index =
    annualAvgRevenue > 0
      ? targetPattern.avgRevenue / annualAvgRevenue
      : 1.0;

  return {
    monthNumber,
    index: round2(index),
    avgOccupancy: targetPattern.avgOccupancy,
    avgRevenue: targetPattern.avgRevenue,
  };
}

// ─────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
