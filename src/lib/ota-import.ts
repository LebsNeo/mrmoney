/**
 * MrCA — OTA Import Engine (v2)
 * Parsers built from real payout file analysis:
 *   - Lekkerslaap: CSV with booking-level line items
 *   - Booking.com: CSV with payout batches + reservation rows
 *   - Airbnb: PDF annual earnings report (monthly summaries)
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// ─────────────────────────────────────────────
// SHARED TYPES
// ─────────────────────────────────────────────

export interface ParsedOTABooking {
  externalRef: string;         // OTA booking/reservation reference
  checkIn?: Date;
  checkOut?: Date;
  grossAmount: number;
  commission: number;          // OTA commission (always positive)
  serviceFee: number;          // Payment handling / service fee (positive)
  vatAmount: number;           // VAT withheld (positive)
  netAmount: number;           // What host actually receives
  status: string;              // Okay, Canceled, Partially canceled
  propertyId?: string;         // OTA's property ID (for multi-property matching)
  propertyName?: string;       // OTA's property name
  roomNights?: number;
  payoutDate?: Date;
  payoutBatchRef?: string;     // Groups bookings into a payout batch
}

export interface ParsedOTAPayout {
  batchRef: string;
  payoutDate: Date;
  payoutAmount: number;
  propertyId?: string;
  propertyName?: string;
  bookings: ParsedOTABooking[];
}

export interface OTAParseResult {
  platform: "LEKKERSLAAP" | "BOOKING_COM" | "AIRBNB";
  payouts: ParsedOTAPayout[];
  periodStart: Date;
  periodEnd: Date;
  totalGross: number;
  totalCommission: number;
  totalServiceFees: number;
  totalNet: number;
  bookingCount: number;
  warnings: string[];
}

// ─────────────────────────────────────────────
// CSV PARSER HELPER
// ─────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
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

function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map((l) => parseCSVLine(l));

  return { headers, rows };
}

function parseAmount(val: string): number {
  if (!val || val === "-" || val === "") return 0;
  const cleaned = val.replace(/[^0-9.\-]/g, "");
  return parseFloat(cleaned) || 0;
}

function parseDateStr(val: string): Date | undefined {
  if (!val || val === "-" || val === "") return undefined;
  // Handles YYYY-MM-DD format
  const d = new Date(val);
  return isNaN(d.getTime()) ? undefined : d;
}

// ─────────────────────────────────────────────
// 1. LEKKERSLAAP CSV PARSER
// ─────────────────────────────────────────────
//
// Real format:
//   Date, "Booking reference", Description, Amount, Balance
//
// Row types per booking:
//   "Guest payment"        → gross amount (positive)
//   "Commission"           → LS commission (negative)
//   "Payment handling fee" → processing fee (negative)
//   "Payout"               → actual transfer date (negative = paid out)
//
// Special rows (no booking ref):
//   "Opening Balance" / "Closing Balance" → skip

export function parseLekkerslaapCSV(csvContent: string): OTAParseResult {
  const warnings: string[] = [];
  const { rows } = parseCSV(csvContent);

  // Group rows by booking reference
  const bookingMap = new Map<
    string,
    {
      guestPayment: number;
      commission: number;
      handlingFee: number;
      payoutDate?: Date;
      rowDate?: Date;
    }
  >();

  for (const row of rows) {
    const [dateStr, bookingRef, description, amountStr] = row;

    // Skip summary rows
    if (
      !bookingRef ||
      description === "Opening Balance" ||
      description === "Closing Balance"
    ) {
      continue;
    }

    const ref = bookingRef.trim();
    const amount = parseAmount(amountStr);
    const rowDate = parseDateStr(dateStr);
    const desc = description.toLowerCase().trim();

    if (!bookingMap.has(ref)) {
      bookingMap.set(ref, {
        guestPayment: 0,
        commission: 0,
        handlingFee: 0,
      });
    }

    const entry = bookingMap.get(ref)!;
    if (!entry.rowDate && rowDate) entry.rowDate = rowDate;

    if (desc === "guest payment") {
      entry.guestPayment = amount; // positive
    } else if (desc === "commission") {
      entry.commission = Math.abs(amount); // store as positive
    } else if (desc === "payment handling fee") {
      entry.handlingFee = Math.abs(amount); // store as positive
    } else if (desc === "payout") {
      entry.payoutDate = rowDate;
    }
  }

  // Group bookings by payout date (each payout date = one batch)
  const payoutBatches = new Map<string, ParsedOTABooking[]>();

  for (const [ref, data] of bookingMap) {
    const netAmount =
      data.guestPayment - data.commission - data.handlingFee;
    const payoutKey = data.payoutDate
      ? data.payoutDate.toISOString().split("T")[0]
      : data.rowDate?.toISOString().split("T")[0] || "unknown";

    const booking: ParsedOTABooking = {
      externalRef: ref, // e.g. LS-5MJZMM
      grossAmount: data.guestPayment,
      commission: data.commission,
      serviceFee: data.handlingFee,
      vatAmount: 0, // Lekkerslaap doesn't separate VAT
      netAmount,
      status: "Okay",
      payoutDate: data.payoutDate,
      payoutBatchRef: payoutKey,
    };

    if (!payoutBatches.has(payoutKey)) {
      payoutBatches.set(payoutKey, []);
    }
    payoutBatches.get(payoutKey)!.push(booking);
  }

  // Build payouts array
  const payouts: ParsedOTAPayout[] = [];
  const allBookings: ParsedOTABooking[] = [];

  for (const [batchKey, bookings] of payoutBatches) {
    const payoutAmount = bookings.reduce((s, b) => s + b.netAmount, 0);
    const payoutDate = bookings[0]?.payoutDate || new Date(batchKey);
    allBookings.push(...bookings);

    payouts.push({
      batchRef: `LS-BATCH-${batchKey}`,
      payoutDate,
      payoutAmount,
      bookings,
    });
  }

  if (allBookings.length === 0) {
    warnings.push("No bookings found in Lekkerslaap CSV");
  }

  const allDates = allBookings
    .filter((b) => b.payoutDate)
    .map((b) => b.payoutDate!.getTime());
  const periodStart =
    allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date();
  const periodEnd =
    allDates.length > 0 ? new Date(Math.max(...allDates)) : new Date();

  return {
    platform: "LEKKERSLAAP",
    payouts,
    periodStart,
    periodEnd,
    totalGross: allBookings.reduce((s, b) => s + b.grossAmount, 0),
    totalCommission: allBookings.reduce((s, b) => s + b.commission, 0),
    totalServiceFees: allBookings.reduce((s, b) => s + b.serviceFee, 0),
    totalNet: allBookings.reduce((s, b) => s + b.netAmount, 0),
    bookingCount: allBookings.length,
    warnings,
  };
}

// ─────────────────────────────────────────────
// 2. BOOKING.COM CSV PARSER
// ─────────────────────────────────────────────
//
// Real format columns:
//   Type/Transaction type, Statement Descriptor, Reference number,
//   Check-in date, Check-out date, Issue date, Reservation status,
//   Rooms, Room nights, Property ID, Property name, Legal ID, Legal name,
//   Country, Payout type, Gross amount, Commission, Commission %,
//   Payments Service Fee, Payments Service Fee %, VAT, Tax,
//   Transaction amount, Transaction currency, Exchange rate,
//   Payable amount, Payout amount, Payout currency, Payout date,
//   Payout frequency, Bank account
//
// Row types:
//   "(Payout)"    → payout batch summary row
//   "Reservation" → individual booking linked to a payout batch
//
// Key: Statement Descriptor groups Reservation rows into a (Payout) batch

export function parseBookingComCSV(csvContent: string): OTAParseResult {
  const warnings: string[] = [];
  const { headers, rows } = parseCSV(csvContent);

  if (headers.length === 0) {
    return {
      platform: "BOOKING_COM",
      payouts: [],
      periodStart: new Date(),
      periodEnd: new Date(),
      totalGross: 0,
      totalCommission: 0,
      totalServiceFees: 0,
      totalNet: 0,
      bookingCount: 0,
      warnings: ["Empty or invalid CSV file"],
    };
  }

  // Map column names to indices (case-insensitive, handles BOM)
  const colIdx = (name: string) => {
    const idx = headers.findIndex(
      (h) => h.replace(/^\uFEFF/, "").toLowerCase().trim() === name.toLowerCase().trim()
    );
    return idx;
  };

  const idxType = colIdx("type/transaction type");
  const idxDescriptor = colIdx("statement descriptor");
  const idxRef = colIdx("reference number");
  const idxCheckIn = colIdx("check-in date");
  const idxCheckOut = colIdx("check-out date");
  const idxStatus = colIdx("reservation status");
  const idxRoomNights = colIdx("room nights");
  const idxPropertyId = colIdx("property id");
  const idxPropertyName = colIdx("property name");
  const idxGross = colIdx("gross amount");
  const idxCommission = colIdx("commission");
  const idxServiceFee = colIdx("payments service fee");
  const idxVAT = colIdx("vat");
  const idxTransactionAmount = colIdx("transaction amount");
  const idxPayoutAmount = colIdx("payout amount");
  const idxPayoutDate = colIdx("payout date");

  // First pass: collect payout batch summaries
  const payoutBatchMap = new Map<
    string,
    {
      payoutDate: Date;
      payoutAmount: number;
      propertyId?: string;
      propertyName?: string;
    }
  >();

  // Second pass: collect reservations grouped by Statement Descriptor
  const reservationMap = new Map<string, ParsedOTABooking[]>();

  for (const row of rows) {
    const rowType = row[idxType]?.trim() || "";
    const descriptor = row[idxDescriptor]?.trim() || "";

    if (rowType === "(Payout)") {
      const payoutDate = parseDateStr(row[idxPayoutDate]) || new Date();
      const payoutAmount = parseAmount(row[idxPayoutAmount]);
      const propertyId = row[idxPropertyId]?.trim();
      const propertyName = row[idxPropertyName]?.replace(/"/g, "").trim();

      payoutBatchMap.set(descriptor, {
        payoutDate,
        payoutAmount,
        propertyId,
        propertyName,
      });
    } else if (rowType === "Reservation") {
      const ref = row[idxRef]?.trim() || "";
      const status = row[idxStatus]?.trim() || "Okay";
      const checkIn = parseDateStr(row[idxCheckIn]);
      const checkOut = parseDateStr(row[idxCheckOut]);
      const roomNights = parseInt(row[idxRoomNights] || "1") || 1;
      const propertyId = row[idxPropertyId]?.trim();
      const propertyName = row[idxPropertyName]?.replace(/"/g, "").trim();
      const payoutDate = parseDateStr(row[idxPayoutDate]);

      // Booking.com commission and service fee are negative in the file
      const grossAmount = parseAmount(row[idxGross]);
      const commission = Math.abs(parseAmount(row[idxCommission]));
      const serviceFeeParsed = parseAmount(row[idxServiceFee]);
      const serviceFee = Math.abs(serviceFeeParsed);
      const vatAmount = Math.abs(parseAmount(row[idxVAT]));
      const netAmount = parseAmount(row[idxTransactionAmount]);

      if (!ref) {
        warnings.push(`Skipping reservation row with no reference number`);
        continue;
      }

      const booking: ParsedOTABooking = {
        externalRef: ref,
        checkIn,
        checkOut,
        grossAmount,
        commission,
        serviceFee: serviceFee,
        vatAmount,
        netAmount,
        status,
        propertyId,
        propertyName,
        roomNights,
        payoutDate,
        payoutBatchRef: descriptor,
      };

      if (!reservationMap.has(descriptor)) {
        reservationMap.set(descriptor, []);
      }
      reservationMap.get(descriptor)!.push(booking);
    }
  }

  // Build payouts array: match reservations to their payout batch
  const payouts: ParsedOTAPayout[] = [];
  const allBookings: ParsedOTABooking[] = [];

  for (const [descriptor, batchInfo] of payoutBatchMap) {
    const bookings = reservationMap.get(descriptor) || [];
    allBookings.push(...bookings);

    payouts.push({
      batchRef: descriptor,
      payoutDate: batchInfo.payoutDate,
      payoutAmount: batchInfo.payoutAmount,
      propertyId: batchInfo.propertyId,
      propertyName: batchInfo.propertyName,
      bookings,
    });
  }

  // Handle any orphan reservations (not linked to a payout batch)
  for (const [descriptor, bookings] of reservationMap) {
    if (!payoutBatchMap.has(descriptor)) {
      warnings.push(
        `Reservations found for batch "${descriptor}" with no matching payout row`
      );
      allBookings.push(...bookings);
      const payoutDate = bookings[0]?.payoutDate || new Date();
      payouts.push({
        batchRef: descriptor,
        payoutDate,
        payoutAmount: bookings.reduce((s, b) => s + b.netAmount, 0),
        bookings,
      });
    }
  }

  if (allBookings.length === 0) {
    warnings.push("No reservations found in Booking.com CSV");
  }

  const payoutDates = payouts.map((p) => p.payoutDate.getTime());
  const periodStart =
    payoutDates.length > 0 ? new Date(Math.min(...payoutDates)) : new Date();
  const periodEnd =
    payoutDates.length > 0 ? new Date(Math.max(...payoutDates)) : new Date();

  return {
    platform: "BOOKING_COM",
    payouts,
    periodStart,
    periodEnd,
    totalGross: allBookings.reduce((s, b) => s + b.grossAmount, 0),
    totalCommission: allBookings.reduce((s, b) => s + b.commission, 0),
    totalServiceFees: allBookings.reduce(
      (s, b) => s + b.serviceFee + b.vatAmount,
      0
    ),
    totalNet: allBookings.reduce((s, b) => s + b.netAmount, 0),
    bookingCount: allBookings.length,
    warnings,
  };
}

// ─────────────────────────────────────────────
// 3. AIRBNB CSV PARSER
// ─────────────────────────────────────────────
//
// Real format: "airbnb-upcoming-all" CSV export from Airbnb Host dashboard
// Path: Earnings → Upcoming Payouts → Download CSV (or Transaction History)
//
// Columns:
//   Date            — payout date (MM/DD/YYYY)
//   Type            — "Reservation" | "Cancellation Fee" | "Adjustment" etc.
//   Confirmation Code — Airbnb booking ref (e.g. HMYKHMDZM2)
//   Booking date    — when guest booked (MM/DD/YYYY)
//   Start date      — check-in (MM/DD/YYYY)
//   End date        — check-out (MM/DD/YYYY)
//   Nights          — integer (provided but NOT stored — derived from dates)
//   Guest           — guest name
//   Listing         — property/listing name
//   Details         — usually empty
//   Reference code  — usually empty
//   Currency        — ZAR
//   Amount          — net payout to host (Gross earnings − Service fee)
//   Paid out        — empty for upcoming / date when actually disbursed
//   Service fee     — Airbnb's host-side fee (~3.45%, always positive)
//   Fast Pay Fee    — optional fast-payout fee (usually empty)
//   Cleaning fee    — cleaning fee if applicable
//   Gross earnings  — total before Airbnb deducts their service fee
//   Occupancy taxes — tax withheld by Airbnb (0 for ZAR in ZA)
//   Earnings year   — fiscal year label (usually empty)
//
// Row type behaviour:
//   "Reservation"       → positive Amount & Gross earnings — normal payout
//   "Cancellation Fee"  → negative Amount, 0 service fee — refund deduction
//   Anything else       → treated as adjustment; Amount used directly
//
// Payout batches: rows with the same Date are grouped into one batch.
// Note: actual Airbnb service fee is ~3.45% (not 3% flat).

function parseAirbnbDate(val: string): Date | undefined {
  if (!val || val.trim() === "") return undefined;
  // MM/DD/YYYY → YYYY-MM-DD
  const parts = val.trim().split("/");
  if (parts.length !== 3) return undefined;
  const [mm, dd, yyyy] = parts;
  const d = new Date(`${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`);
  return isNaN(d.getTime()) ? undefined : d;
}

export function parseAirbnbCSV(csvContent: string): OTAParseResult {
  const warnings: string[] = [];
  const { headers, rows } = parseCSV(csvContent);

  if (headers.length === 0) {
    return {
      platform: "AIRBNB",
      payouts: [],
      periodStart: new Date(),
      periodEnd: new Date(),
      totalGross: 0,
      totalCommission: 0,
      totalServiceFees: 0,
      totalNet: 0,
      bookingCount: 0,
      warnings: ["Empty or invalid Airbnb CSV file"],
    };
  }

  // Case-insensitive column index helper (handles BOM on first column)
  const col = (name: string) =>
    headers.findIndex(
      (h) => h.replace(/^\uFEFF/, "").toLowerCase().trim() === name.toLowerCase().trim()
    );

  const iDate        = col("date");
  const iType        = col("type");
  const iCode        = col("confirmation code");
  const iBookingDate = col("booking date");
  const iStartDate   = col("start date");
  const iEndDate     = col("end date");
  const iGuest       = col("guest");
  const iListing     = col("listing");
  const iCurrency    = col("currency");
  const iAmount      = col("amount");
  const iPaidOut     = col("paid out");
  const iServiceFee  = col("service fee");
  const iCleaning    = col("cleaning fee");
  const iGross       = col("gross earnings");
  const iOccTax      = col("occupancy taxes");

  // Group bookings by payout date (each unique date = one batch)
  const batchMap = new Map<string, ParsedOTABooking[]>();

  let reservationCount = 0;

  for (const row of rows) {
    const rowType   = (row[iType] || "").trim();
    const confCode  = (row[iCode] || "").trim();
    const dateStr   = (row[iDate] || "").trim();
    const payoutDate = parseAirbnbDate(dateStr);
    const batchKey  = dateStr || "unknown";

    // Parse amounts
    const grossEarnings = parseAmount(row[iGross] || "");
    const serviceFee    = parseAmount(row[iServiceFee] || "");
    const cleaningFee   = parseAmount(row[iCleaning] || "");
    const occTax        = parseAmount(row[iOccTax] || "");
    const amount        = parseAmount(row[iAmount] || "");

    // Derive net: Amount column IS the net (Airbnb already subtracted service fee)
    // For cancellations, amount is negative — keep as-is.
    const netAmount  = amount;
    const gross      = grossEarnings || (rowType === "Reservation" ? Math.abs(amount) + serviceFee : 0);
    const commission = serviceFee; // Airbnb calls it "service fee" on host side

    const booking: ParsedOTABooking = {
      externalRef:    confCode || `AIR-${dateStr}-${Math.random().toString(36).slice(2, 7)}`,
      checkIn:        parseAirbnbDate(row[iStartDate] || ""),
      checkOut:       parseAirbnbDate(row[iEndDate] || ""),
      grossAmount:    gross,
      commission,
      serviceFee:     0,     // commission already captures the host-side fee
      vatAmount:      occTax,
      netAmount,
      status:         rowType === "Cancellation Fee" ? "Canceled" : "Okay",
      propertyName:   (row[iListing] || "").trim(),
      payoutDate,
      payoutBatchRef: batchKey,
    };

    if (rowType === "Reservation") reservationCount++;

    if (!batchMap.has(batchKey)) batchMap.set(batchKey, []);
    batchMap.get(batchKey)!.push(booking);
  }

  // Build payouts
  const payouts: ParsedOTAPayout[] = [];
  const allBookings: ParsedOTABooking[] = [];

  for (const [batchKey, bookings] of batchMap) {
    const payoutDate  = bookings[0]?.payoutDate || new Date(batchKey);
    const payoutAmount = bookings.reduce((s, b) => s + b.netAmount, 0);
    allBookings.push(...bookings);

    payouts.push({
      batchRef:     `AIR-BATCH-${batchKey.replace(/\//g, "")}`,
      payoutDate,
      payoutAmount,
      propertyName: bookings[0]?.propertyName,
      bookings,
    });
  }

  if (allBookings.length === 0) {
    warnings.push("No rows found in Airbnb CSV");
  }
  if (reservationCount === 0 && allBookings.length > 0) {
    warnings.push("No 'Reservation' rows found — file may contain only cancellations/adjustments");
  }

  const dates = allBookings
    .filter((b) => b.payoutDate)
    .map((b) => b.payoutDate!.getTime());
  const periodStart = dates.length > 0 ? new Date(Math.min(...dates)) : new Date();
  const periodEnd   = dates.length > 0 ? new Date(Math.max(...dates)) : new Date();

  return {
    platform:        "AIRBNB",
    payouts,
    periodStart,
    periodEnd,
    totalGross:      allBookings.reduce((s, b) => s + b.grossAmount, 0),
    totalCommission: allBookings.reduce((s, b) => s + b.commission, 0),
    totalServiceFees: allBookings.reduce((s, b) => s + b.serviceFee, 0),
    totalNet:        allBookings.reduce((s, b) => s + b.netAmount, 0),
    bookingCount:    reservationCount,
    warnings,
  };
}

// ─────────────────────────────────────────────
// BOOKING MATCHER
// ─────────────────────────────────────────────
// Tries to match OTA payout items to existing bookings in DB

export async function matchPayoutBookingsToLocal(
  items: ParsedOTABooking[],
  propertyDbId: string
): Promise<Map<string, string>> {
  const matchMap = new Map<string, string>(); // externalRef → booking.id

  if (items.length === 0) return matchMap;

  // Batch fetch bookings that might match
  const bookings = await prisma.booking.findMany({
    where: {
      propertyId: propertyDbId,
      deletedAt: null,
    },
    select: {
      id: true,
      externalRef: true,
      checkIn: true,
      checkOut: true,
      guestName: true,
      source: true,
    },
  });

  for (const item of items) {
    // Strategy 1: exact externalRef match
    const exactMatch = bookings.find(
      (b) =>
        b.externalRef &&
        b.externalRef.toLowerCase() === item.externalRef.toLowerCase()
    );
    if (exactMatch) {
      matchMap.set(item.externalRef, exactMatch.id);
      continue;
    }

    // Strategy 2: check-in date match (within 1 day) + approximate amount
    if (item.checkIn) {
      const checkInTime = item.checkIn.getTime();
      const dayMs = 86400000;
      const dateMatch = bookings.find((b) => {
        const bTime = new Date(b.checkIn).getTime();
        return Math.abs(bTime - checkInTime) <= dayMs;
      });
      if (dateMatch) {
        matchMap.set(item.externalRef, dateMatch.id);
        logger.info("OTA match via check-in date", {
          externalRef: item.externalRef,
          bookingId: dateMatch.id,
        });
      }
    }
  }

  return matchMap;
}

// ─────────────────────────────────────────────
// SAVE TO DATABASE
// ─────────────────────────────────────────────

export async function saveOTAPayoutsToDb(
  parseResult: OTAParseResult,
  propertyDbId: string,
  organisationId: string,
  importFilename: string
): Promise<{
  payoutsCreated: number;
  itemsCreated: number;
  itemsMatched: number;
  warnings: string[];
}> {
  let payoutsCreated = 0;
  let itemsCreated = 0;
  let itemsMatched = 0;
  const warnings = [...parseResult.warnings];

  for (const payout of parseResult.payouts) {
    // Collect all bookings that need matching
    const matchMap = await matchPayoutBookingsToLocal(
      payout.bookings,
      propertyDbId
    );

    const grossAmount = payout.bookings.reduce(
      (s, b) => s + b.grossAmount,
      0
    );
    const totalCommission = payout.bookings.reduce(
      (s, b) => s + b.commission + b.serviceFee,
      0
    );
    const netAmount = payout.payoutAmount || payout.bookings.reduce(
      (s, b) => s + b.netAmount,
      0
    );

    const dbPayout = await prisma.oTAPayout.create({
      data: {
        organisationId,
        propertyId: propertyDbId,
        platform: parseResult.platform,
        periodStart: parseResult.periodStart,
        periodEnd: parseResult.periodEnd,
        payoutDate: payout.payoutDate,
        grossAmount,
        totalCommission,
        netAmount,
        status: "IMPORTED",
        importFilename,
      },
    });
    payoutsCreated++;

    // Create payout items for booking-level data (not available for Airbnb monthly)
    for (const booking of payout.bookings) {
      const matchedBookingId = matchMap.get(booking.externalRef);
      if (matchedBookingId) itemsMatched++;

      await prisma.oTAPayoutItem.create({
        data: {
          payoutId: dbPayout.id,
          bookingId: matchedBookingId || null,
          externalBookingRef: booking.externalRef,
          guestName: "–",
          checkIn: booking.checkIn || payout.payoutDate,
          checkOut: booking.checkOut || payout.payoutDate,
          grossAmount: booking.grossAmount,
          commission: booking.commission + booking.serviceFee,
          netAmount: booking.netAmount,
          isMatched: !!matchedBookingId,
        },
      });
      itemsCreated++;
    }
  }

  logger.info("OTA import complete", {
    platform: parseResult.platform,
    payoutsCreated,
    itemsCreated,
    itemsMatched,
  });

  return { payoutsCreated, itemsCreated, itemsMatched, warnings };
}
