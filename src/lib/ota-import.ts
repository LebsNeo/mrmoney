/**
 * MrMoney — OTA CSV Import Engine
 * Phase 3: OTA Payout CSV Parser + Matcher
 *
 * Supports Airbnb and Booking.com CSV formats.
 * Matches payout items to bookings via externalRef, then guest name + date proximity.
 */

import { prisma } from "@/lib/prisma";
import { OTAPlatform } from "@prisma/client";
import { logger } from "@/lib/logger";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface ParsedPayoutItem {
  externalBookingRef: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
  grossAmount: number;
  commission: number;
  netAmount: number;
}

export interface OTAImportResult {
  success: boolean;
  payoutId?: string;
  message: string;
  totalItems: number;
  matchedItems: number;
}

// ─────────────────────────────────────────────
// CSV PARSER HELPERS
// ─────────────────────────────────────────────

/**
 * Parse a CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parse CSV content into rows (array of header→value maps)
 */
function parseCSV(csvContent: string): Array<Record<string, string>> {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

function parseAmount(val: string): number {
  const cleaned = val.replace(/[^0-9.\-]/g, "");
  return parseFloat(cleaned) || 0;
}

function parseDate(val: string): Date {
  const cleaned = val.trim();
  // Try ISO first (2024-12-25)
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
    return new Date(cleaned);
  }
  // Try DD/MM/YYYY
  const dmy = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) {
    return new Date(`${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`);
  }
  // Try MM/DD/YYYY
  const mdy = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) {
    return new Date(`${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`);
  }
  return new Date(cleaned);
}

// ─────────────────────────────────────────────
// AIRBNB CSV PARSER
// Expected columns (flexible matching):
//   confirmation_code, guest, check-in, checkout, amount, host_fee, payout
// ─────────────────────────────────────────────

export function parseAirbnbCSV(csvContent: string): ParsedPayoutItem[] {
  const rows = parseCSV(csvContent);
  const items: ParsedPayoutItem[] = [];

  for (const row of rows) {
    // Try multiple column name variants
    const ref =
      row["confirmation_code"] ||
      row["confirmation code"] ||
      row["booking_id"] ||
      row["booking id"] ||
      row["ref"] ||
      "";

    const guest =
      row["guest"] ||
      row["guest name"] ||
      row["guest_name"] ||
      row["name"] ||
      "";

    const checkInRaw =
      row["check-in"] || row["checkin"] || row["check_in"] || row["arrival"] || "";
    const checkOutRaw =
      row["checkout"] || row["check-out"] || row["check_out"] || row["departure"] || "";

    const grossRaw =
      row["amount"] || row["gross_amount"] || row["gross amount"] || row["total_paid"] || "0";
    const commissionRaw =
      row["host_fee"] ||
      row["host fee"] ||
      row["service_fee"] ||
      row["airbnb_fee"] ||
      row["commission"] ||
      "0";
    const netRaw =
      row["payout"] || row["net_amount"] || row["net amount"] || row["you_earned"] || "0";

    if (!ref && !guest) continue; // Skip empty rows

    const grossAmount = Math.abs(parseAmount(grossRaw));
    const commission = Math.abs(parseAmount(commissionRaw));
    const netAmount =
      parseAmount(netRaw) !== 0
        ? Math.abs(parseAmount(netRaw))
        : grossAmount - commission;

    if (grossAmount === 0 && netAmount === 0) continue;

    let checkIn: Date;
    let checkOut: Date;
    try {
      checkIn = parseDate(checkInRaw);
      checkOut = parseDate(checkOutRaw);
    } catch {
      continue;
    }

    items.push({
      externalBookingRef: ref || `AIRBNB-${guest.replace(/\s+/g, "").slice(0, 8)}-${Date.now()}`,
      guestName: guest,
      checkIn,
      checkOut,
      grossAmount,
      commission,
      netAmount,
    });
  }

  return items;
}

// ─────────────────────────────────────────────
// BOOKING.COM CSV PARSER
// Expected columns (flexible matching):
//   reservation_id, guest_name, arrival_date, departure_date, room_revenue, commission, net_revenue
// ─────────────────────────────────────────────

export function parseBookingComCSV(csvContent: string): ParsedPayoutItem[] {
  const rows = parseCSV(csvContent);
  const items: ParsedPayoutItem[] = [];

  for (const row of rows) {
    const ref =
      row["reservation_id"] ||
      row["reservation id"] ||
      row["booking_id"] ||
      row["booking id"] ||
      row["id"] ||
      "";

    const guest =
      row["guest_name"] ||
      row["guest name"] ||
      row["booker name"] ||
      row["booker_name"] ||
      row["name"] ||
      "";

    const checkInRaw =
      row["arrival_date"] || row["arrival date"] || row["check-in"] || row["checkin"] || "";
    const checkOutRaw =
      row["departure_date"] || row["departure date"] || row["check-out"] || row["checkout"] || "";

    const grossRaw =
      row["room_revenue"] ||
      row["room revenue"] ||
      row["gross_amount"] ||
      row["gross amount"] ||
      row["total"] ||
      "0";
    const commissionRaw =
      row["commission"] || row["booking_commission"] || row["platform_fee"] || "0";
    const netRaw =
      row["net_revenue"] ||
      row["net revenue"] ||
      row["payout"] ||
      row["net_amount"] ||
      "0";

    if (!ref && !guest) continue;

    const grossAmount = Math.abs(parseAmount(grossRaw));
    const commission = Math.abs(parseAmount(commissionRaw));
    const netAmount =
      parseAmount(netRaw) !== 0
        ? Math.abs(parseAmount(netRaw))
        : grossAmount - commission;

    if (grossAmount === 0 && netAmount === 0) continue;

    let checkIn: Date;
    let checkOut: Date;
    try {
      checkIn = parseDate(checkInRaw);
      checkOut = parseDate(checkOutRaw);
    } catch {
      continue;
    }

    items.push({
      externalBookingRef: ref || `BDC-${guest.replace(/\s+/g, "").slice(0, 8)}-${Date.now()}`,
      guestName: guest,
      checkIn,
      checkOut,
      grossAmount,
      commission,
      netAmount,
    });
  }

  return items;
}

// ─────────────────────────────────────────────
// MATCH PAYOUT ITEMS TO BOOKINGS
// 1. Match by externalRef (exact)
// 2. Fallback: guest name similarity + date proximity (±1 day)
// ─────────────────────────────────────────────

export async function matchPayoutItemsToBookings(
  items: ParsedPayoutItem[],
  propertyId: string
): Promise<Map<number, string>> {
  // Fetch all bookings for the property (with externalRef and guest info)
  const bookings = await prisma.booking.findMany({
    where: { propertyId, deletedAt: null },
    select: {
      id: true,
      externalRef: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
    },
  });

  const matches = new Map<number, string>(); // item index → booking id

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Strategy 1: exact externalRef match
    const byRef = bookings.find(
      (b) =>
        b.externalRef &&
        b.externalRef.toLowerCase() === item.externalBookingRef.toLowerCase()
    );
    if (byRef) {
      matches.set(i, byRef.id);
      continue;
    }

    // Strategy 2: guest name + date proximity (within 1 day)
    const normalizedItemGuest = item.guestName.toLowerCase().trim();
    const itemCheckInTime = item.checkIn.getTime();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    const byNameAndDate = bookings.find((b) => {
      const bGuestNorm = b.guestName.toLowerCase().trim();
      const bCheckInTime = new Date(b.checkIn).getTime();

      const nameMatch =
        bGuestNorm === normalizedItemGuest ||
        bGuestNorm.includes(normalizedItemGuest) ||
        normalizedItemGuest.includes(bGuestNorm);

      const dateMatch = Math.abs(bCheckInTime - itemCheckInTime) <= ONE_DAY_MS;

      return nameMatch && dateMatch;
    });

    if (byNameAndDate) {
      matches.set(i, byNameAndDate.id);
    }
  }

  return matches;
}

// ─────────────────────────────────────────────
// CREATE OTA PAYOUT — atomically creates payout + items + runs matching
// ─────────────────────────────────────────────

export async function createOTAPayout(
  propertyId: string,
  platform: OTAPlatform,
  items: ParsedPayoutItem[],
  filename: string
): Promise<OTAImportResult> {
  if (items.length === 0) {
    return { success: false, message: "No valid payout items found in CSV", totalItems: 0, matchedItems: 0 };
  }

  try {
    // Get organisationId from property
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { organisationId: true },
    });
    if (!property) {
      return { success: false, message: "Property not found", totalItems: 0, matchedItems: 0 };
    }

    // Run matching before transaction
    const matches = await matchPayoutItemsToBookings(items, propertyId);

    // Compute aggregates
    const grossAmount = items.reduce((sum, i) => sum + i.grossAmount, 0);
    const totalCommission = items.reduce((sum, i) => sum + i.commission, 0);
    const netAmount = items.reduce((sum, i) => sum + i.netAmount, 0);

    // Period: min checkIn → max checkOut
    const periodStart = items.reduce(
      (min, i) => (i.checkIn < min ? i.checkIn : min),
      items[0].checkIn
    );
    const periodEnd = items.reduce(
      (max, i) => (i.checkOut > max ? i.checkOut : max),
      items[0].checkOut
    );

    let payoutId: string;

    await prisma.$transaction(async (tx) => {
      const payout = await tx.oTAPayout.create({
        data: {
          organisationId: property.organisationId,
          propertyId,
          platform,
          periodStart,
          periodEnd,
          payoutDate: new Date(),
          grossAmount,
          totalCommission,
          netAmount,
          status: "IMPORTED",
          importFilename: filename,
        },
      });
      payoutId = payout.id;

      // Create payout items
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const matchedBookingId = matches.get(i);

        await tx.oTAPayoutItem.create({
          data: {
            payoutId: payout.id,
            bookingId: matchedBookingId ?? null,
            externalBookingRef: item.externalBookingRef,
            guestName: item.guestName,
            checkIn: item.checkIn,
            checkOut: item.checkOut,
            grossAmount: item.grossAmount,
            commission: item.commission,
            netAmount: item.netAmount,
            isMatched: !!matchedBookingId,
          },
        });
      }
    });

    logger.info("OTA payout imported", {
      payoutId: payoutId!,
      totalItems: items.length,
      matchedItems: matches.size,
    });
    return {
      success: true,
      payoutId: payoutId!,
      message: `Imported ${items.length} items. ${matches.size} matched to bookings.`,
      totalItems: items.length,
      matchedItems: matches.size,
    };
  } catch (err) {
    logger.error("OTA payout import failed", err);
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: msg, totalItems: items.length, matchedItems: 0 };
  }
}
