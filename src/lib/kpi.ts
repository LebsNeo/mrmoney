/**
 * MrMoney — KPI Calculation Engine
 * Phase 1: Core Hospitality KPIs
 *
 * All amounts in Decimal-safe numbers (pass as strings or numbers, returns number).
 * nights must ALWAYS be derived from checkIn/checkOut — never stored.
 */

import { differenceInCalendarDays } from "date-fns";

// ─────────────────────────────────────────────
// DATE HELPERS
// ─────────────────────────────────────────────

/**
 * Derive number of nights from check-in / check-out.
 * This is the ONLY place nights is computed.
 */
export function calcNights(checkIn: Date, checkOut: Date): number {
  const nights = differenceInCalendarDays(checkOut, checkIn);
  if (nights <= 0) throw new Error("checkOut must be after checkIn");
  return nights;
}

// ─────────────────────────────────────────────
// VAT HELPERS
// ─────────────────────────────────────────────

/**
 * Calculate VAT amount.
 * @param amount - The base amount
 * @param rate - VAT rate as decimal (e.g. 0.15 for 15%)
 * @param isInclusive - If true, amount already includes VAT
 */
export function calcVATAmount(
  amount: number,
  rate: number,
  isInclusive: boolean
): { vatAmount: number; exclusiveAmount: number; inclusiveAmount: number } {
  if (isInclusive) {
    const exclusiveAmount = amount / (1 + rate);
    const vatAmount = amount - exclusiveAmount;
    return {
      vatAmount: round(vatAmount),
      exclusiveAmount: round(exclusiveAmount),
      inclusiveAmount: round(amount),
    };
  } else {
    const vatAmount = amount * rate;
    return {
      vatAmount: round(vatAmount),
      exclusiveAmount: round(amount),
      inclusiveAmount: round(amount + vatAmount),
    };
  }
}

// ─────────────────────────────────────────────
// CORE KPIs
// ─────────────────────────────────────────────

/**
 * Occupancy Rate — % of available rooms occupied
 * @param occupiedRooms - Number of occupied room-nights
 * @param totalRooms - Total rooms in property
 * @param days - Period in days
 * @returns Occupancy rate as a decimal (e.g. 0.75 = 75%)
 */
export function calcOccupancyRate(
  occupiedRooms: number,
  totalRooms: number,
  days: number
): number {
  const availableRoomNights = totalRooms * days;
  if (availableRoomNights === 0) return 0;
  return round(occupiedRooms / availableRoomNights);
}

/**
 * ADR — Average Daily Rate
 * Total room revenue / number of occupied room nights
 * @param totalRevenue - Total room revenue (excl. VAT)
 * @param occupiedRooms - Total occupied room-nights
 */
export function calcADR(totalRevenue: number, occupiedRooms: number): number {
  if (occupiedRooms === 0) return 0;
  return round(totalRevenue / occupiedRooms);
}

/**
 * RevPAR — Revenue Per Available Room
 * Total room revenue / total available room nights
 * @param totalRevenue - Total room revenue (excl. VAT)
 * @param totalRooms - Total rooms in property
 * @param days - Period in days
 */
export function calcRevPAR(
  totalRevenue: number,
  totalRooms: number,
  days: number
): number {
  const availableRoomNights = totalRooms * days;
  if (availableRoomNights === 0) return 0;
  return round(totalRevenue / availableRoomNights);
}

/**
 * Profit Per Room
 * Net revenue minus expenses, divided by total rooms
 * @param netRevenue - Total net revenue (excl. VAT, commissions)
 * @param totalExpenses - Total operating expenses
 * @param totalRooms - Total rooms in property
 */
export function calcProfitPerRoom(
  netRevenue: number,
  totalExpenses: number,
  totalRooms: number
): number {
  if (totalRooms === 0) return 0;
  return round((netRevenue - totalExpenses) / totalRooms);
}

/**
 * Net Revenue Per Booking
 * Gross amount minus OTA commission
 */
export function calcNetRevenuePerBooking(
  grossAmount: number,
  otaCommission: number
): number {
  return round(grossAmount - otaCommission);
}

/**
 * Cost Per Occupied Room Night
 * @param totalExpenses - Total operating expenses for the period
 * @param occupiedRoomNights - Total occupied room nights
 */
export function calcCostPerOccupiedRoom(
  totalExpenses: number,
  occupiedRoomNights: number
): number {
  if (occupiedRoomNights === 0) return 0;
  return round(totalExpenses / occupiedRoomNights);
}

/**
 * Revenue Leakage
 * Difference between expected OTA payouts and actual received
 * @param expectedPayouts - Sum of net amounts from bookings
 * @param actualPayouts - Sum of OTA payout net amounts received
 */
export function detectRevenueLeakage(
  expectedPayouts: number,
  actualPayouts: number
): { leakage: number; leakagePercent: number } {
  const leakage = round(expectedPayouts - actualPayouts);
  const leakagePercent =
    expectedPayouts === 0 ? 0 : round((leakage / expectedPayouts) * 100);
  return { leakage, leakagePercent };
}

// ─────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────

function round(value: number, decimals = 2): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}
