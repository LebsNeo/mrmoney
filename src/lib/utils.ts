/**
 * MrCA — General Utilities
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";

// Prisma Decimal compatible type
type DecimalLike = { toString(): string } | number | string;

// ─────────────────────────────────────────────
// TAILWIND
// ─────────────────────────────────────────────

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─────────────────────────────────────────────
// CURRENCY
// ─────────────────────────────────────────────

/**
 * Format a Decimal or number as currency
 * @param amount - Amount to format
 * @param currency - ISO currency code (default: ZAR)
 * @param locale - Locale string (default: en-ZA)
 */
export function formatCurrency(
  amount: DecimalLike,
  currency = "ZAR",
  locale = "en-ZA"
): string {
  const num = typeof amount === "object" ? parseFloat(amount.toString()) : Number(amount);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format a Decimal or number as a plain number string
 */
export function formatAmount(amount: DecimalLike): string {
  const num = typeof amount === "object" ? parseFloat(amount.toString()) : Number(amount);
  return num.toFixed(2);
}

/**
 * Convert Decimal to number safely
 */
export function toNumber(value: DecimalLike): number {
  if (typeof value === "number") return value;
  return parseFloat(value.toString());
}

// ─────────────────────────────────────────────
// DATES
// ─────────────────────────────────────────────

export function formatDate(date: Date | string, pattern = "dd MMM yyyy"): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, pattern);
}

/**
 * SAST-aware date formatter for @db.Date fields.
 * Dates stored as midnight SAST (UTC-2). On Vercel (UTC) they arrive as midnight UTC+2 = 22:00 UTC prior day.
 * Adding SAST_OFFSET_MS before formatting ensures the correct calendar date shows regardless of server timezone.
 */
export function formatSASTDate(date: Date | string, pattern = "dd MMM yyyy"): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  const sast = new Date(d.getTime() + SAST_OFFSET_MS);
  return format(sast, pattern);
}

/**
 * Calculate nights between two @db.Date values (SAST-stored).
 */
export function calcNightsSAST(checkIn: Date | string, checkOut: Date | string): number {
  const inD = typeof checkIn === "string" ? parseISO(checkIn) : checkIn;
  const outD = typeof checkOut === "string" ? parseISO(checkOut) : checkOut;
  return Math.round((outD.getTime() - inD.getTime()) / (24 * 60 * 60 * 1000));
}

export function formatDateShort(date: Date | string): string {
  return formatDate(date, "dd/MM/yyyy");
}

export function formatMonth(date: Date | string): string {
  return formatDate(date, "MMMM yyyy");
}

export function currentPeriod(): string {
  return format(new Date(), "yyyy-MM");
}

// ─────────────────────────────────────────────
// STRINGS
// ─────────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateInvoiceNumber(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(5, "0")}`;
}

// ─────────────────────────────────────────────
// PERCENTAGES
// ─────────────────────────────────────────────

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

// ─────────────────────────────────────────────
// SAST DATE RANGES (UTC+2)
// Vercel runs in UTC. Dates stored in DB as midnight SAST = UTC-2h.
// Always use these helpers for day-based queries.
// ─────────────────────────────────────────────
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000; // 2 hours

export function getSASTDayRange(date?: Date): { start: Date; end: Date } {
  const base = date ?? new Date();
  // Shift into SAST (+2h) first, THEN find midnight — this is the correct order.
  // Bug with the old approach: taking UTC midnight then subtracting 2h means
  // between 22:00–23:59 UTC (midnight–2am SAST) you'd compute the previous day's range.
  const sastNow = new Date(base.getTime() + SAST_OFFSET_MS);
  const sastMidnight = new Date(sastNow);
  sastMidnight.setUTCHours(0, 0, 0, 0); // midnight in SAST "space"
  // Shift back to UTC to get the actual UTC timestamp of SAST midnight
  const start = new Date(sastMidnight.getTime() - SAST_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}

export function getSASTYesterdayRange(): { start: Date; end: Date } {
  // Subtract 24h from now and get that day's SAST range
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return getSASTDayRange(yesterday);
}
