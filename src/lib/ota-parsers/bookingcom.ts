/**
 * Booking.com Payout Statement CSV Parser
 *
 * Format (from Finance > Statements export):
 *   Type/Transaction type, Statement Descriptor, Reference number, Check-in date,
 *   Check-out date, Issue date, Reservation status, Rooms, Room nights, Property ID,
 *   Property name, Legal ID, Legal name, Country, Payout type, Gross amount,
 *   Commission, Commission %, Payments Service Fee, Payments Service Fee %,
 *   VAT, Tax, Transaction amount, Transaction currency, Exchange rate,
 *   Payable amount, Payout amount, Payout currency, Payout date, Payout frequency,
 *   Bank account
 *
 * Structure:
 *   "(Payout)" rows   = the actual bank deposit (one per batch)
 *   "Reservation" rows = individual bookings under that payout
 *
 * Bank matching: Statement Descriptor appears verbatim (uppercased) in bank
 *   transaction description, e.g. "INTERBANK CREDIT TRANSFER NO.WKCTZRMZDBQPJLWZ/..."
 */

export interface BookingComPayout {
  statementDescriptor: string  // reconciliation key — matches bank description
  propertyId: string           // Booking.com property ID
  propertyName: string
  payoutAmount: number
  payoutCurrency: string
  payoutDate: Date
  reservations: BookingComReservation[]
}

export interface BookingComReservation {
  statementDescriptor: string
  referenceNumber: string
  checkIn: Date
  checkOut: Date
  issueDate: Date
  reservationStatus: string    // Okay | Canceled | Partially canceled
  rooms: number
  roomNights: number
  propertyId: string
  propertyName: string
  grossAmount: number
  commission: number           // negative
  commissionPct: number        // e.g. 15.0
  serviceFee: number           // negative
  serviceFeePct: number        // e.g. 2.1
  vat: number                  // negative
  transactionAmount: number    // net after all deductions
  payoutDate: Date
}

export interface BookingComParseResult {
  payouts: BookingComPayout[]
  skippedRows: number
  errors: string[]
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim())
      current = ""
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

function num(raw: string): number {
  if (!raw || raw === "-") return 0
  return parseFloat(raw.replace(/[^0-9.\-]/g, "")) || 0
}

function pct(raw: string): number {
  // "15.00%" → 15.0
  return parseFloat(raw.replace(/[^0-9.]/g, "")) || 0
}

function parseISODate(raw: string): Date {
  const d = new Date(raw + "T12:00:00Z")
  return isNaN(d.getTime()) ? new Date() : d
}

export function parseBookingComCSV(csvContent: string): BookingComParseResult {
  const lines = csvContent.split(/\r?\n/).filter(l => l.trim() !== "")
  const payouts = new Map<string, BookingComPayout>()
  let skippedRows = 0
  const errors: string[] = []

  // Find header row
  let headerIdx = -1
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (lines[i].toLowerCase().includes("statement descriptor") &&
        lines[i].toLowerCase().includes("reference number")) {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) {
    errors.push("Header row not found")
    return { payouts: [], skippedRows: 0, errors }
  }

  // Map column indices from header
  const headers = parseCSVLine(lines[headerIdx]).map(h => h.toLowerCase().trim())
  const col = (name: string) => headers.indexOf(name)

  const C = {
    type:        col("type/transaction type"),
    descriptor:  col("statement descriptor"),
    refNum:      col("reference number"),
    checkIn:     col("check-in date"),
    checkOut:    col("check-out date"),
    issueDate:   col("issue date"),
    status:      col("reservation status"),
    rooms:       col("rooms"),
    roomNights:  col("room nights"),
    propId:      col("property id"),
    propName:    col("property name"),
    gross:       col("gross amount"),
    commission:  col("commission"),
    commPct:     col("commission %"),
    svcFee:      col("payments service fee"),
    svcFeePct:   col("payments service fee %"),
    vat:         col("vat"),
    txAmount:    col("transaction amount"),
    txCurrency:  col("transaction currency"),
    payableAmt:  col("payable amount"),
    payoutAmt:   col("payout amount"),
    payoutCurr:  col("payout currency"),
    payoutDate:  col("payout date"),
  }

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    const f = parseCSVLine(line)
    const type = (f[C.type] ?? "").trim()
    const descriptor = (f[C.descriptor] ?? "").trim()

    if (!descriptor) { skippedRows++; continue }

    if (type === "(Payout)") {
      const payoutAmt = num(f[C.payoutAmt])
      if (payoutAmt === 0) { skippedRows++; continue }

      payouts.set(descriptor, {
        statementDescriptor: descriptor,
        propertyId: (f[C.propId] ?? "").trim(),
        propertyName: (f[C.propName] ?? "").trim(),
        payoutAmount: payoutAmt,
        payoutCurrency: (f[C.payoutCurr] ?? "ZAR").trim(),
        payoutDate: parseISODate(f[C.payoutDate] ?? ""),
        reservations: [],
      })

    } else if (type === "Reservation") {
      const reservation: BookingComReservation = {
        statementDescriptor: descriptor,
        referenceNumber: (f[C.refNum] ?? "").trim(),
        checkIn: parseISODate(f[C.checkIn] ?? ""),
        checkOut: parseISODate(f[C.checkOut] ?? ""),
        issueDate: parseISODate(f[C.issueDate] ?? ""),
        reservationStatus: (f[C.status] ?? "").trim(),
        rooms: parseInt(f[C.rooms] ?? "1") || 1,
        roomNights: parseInt(f[C.roomNights] ?? "1") || 1,
        propertyId: (f[C.propId] ?? "").trim(),
        propertyName: (f[C.propName] ?? "").trim(),
        grossAmount: num(f[C.gross]),
        commission: num(f[C.commission]),
        commissionPct: pct(f[C.commPct]),
        serviceFee: num(f[C.svcFee]),
        serviceFeePct: pct(f[C.svcFeePct]),
        vat: num(f[C.vat]),
        transactionAmount: num(f[C.txAmount]),
        payoutDate: parseISODate(f[C.payoutDate] ?? ""),
      }

      // Attach to parent payout
      const parent = payouts.get(descriptor)
      if (parent) {
        parent.reservations.push(reservation)
      } else {
        // Reservation before payout header — create placeholder
        payouts.set(descriptor, {
          statementDescriptor: descriptor,
          propertyId: reservation.propertyId,
          propertyName: reservation.propertyName,
          payoutAmount: 0, // will be filled when payout row is found
          payoutCurrency: "ZAR",
          payoutDate: reservation.payoutDate,
          reservations: [reservation],
        })
      }
    } else {
      skippedRows++
    }
  }

  return {
    payouts: Array.from(payouts.values()),
    skippedRows,
    errors,
  }
}
