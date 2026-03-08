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
  // Midnight UTC of the day
  const utcMidnight = new Date(base);
  utcMidnight.setUTCHours(0, 0, 0, 0);
  // Shift back 2h to get SAST midnight (= UTC 22:00 previous day)
  const start = new Date(utcMidnight.getTime() - SAST_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}

export function getSASTYesterdayRange(): { start: Date; end: Date } {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return getSASTDayRange(yesterday);
}
