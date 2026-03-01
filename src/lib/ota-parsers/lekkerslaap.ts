/**
 * Lekkerslaap Statement CSV Parser
 *
 * Format (from Lekkerslaap dashboard export):
 *   Date, Booking reference, Description, Amount, Balance
 *
 * Structure per booking (3 rows sharing the same booking reference):
 *   Guest payment   → positive amount (gross)
 *   Commission      → negative (17.25% effective = 15% + 15% VAT on commission)
 *   Payment handling fee → negative (~2.07%)
 *
 * Payout rows (no booking reference):
 *   Payout          → negative accumulated net paid to bank
 *
 * Bank matching: amount + date + "LEKKESLAAP" keyword in bank description
 * (no unique identifier in bank — must match by amount proximity + date)
 *
 * Special rows: "Opening Balance", "Closing Balance" → skip
 */

export interface LekkerslaapBooking {
  bookingRef: string           // e.g. LS-5MJZMM
  guestPayment: number         // gross amount received from guest
  commission: number           // negative — Lekkerslaap commission incl. VAT
  paymentHandlingFee: number   // negative — payment processing fee
  netAmount: number            // guestPayment + commission + handlingFee
  date: Date                   // date of issue/settlement
}

export interface LekkerslaapPayout {
  payoutDate: Date
  payoutAmount: number         // net paid to bank (positive)
  bankKeyword: string          // always "LEKKESLAAP" for bank matching
  bookings: LekkerslaapBooking[]  // which bookings this payout covers (best-effort)
}

export interface LekkerslaapParseResult {
  payouts: LekkerslaapPayout[]
  pendingBalance: number       // closing balance not yet paid out
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
  if (!raw || raw.trim() === "") return 0
  return parseFloat(raw.replace(/[^0-9.\-]/g, "")) || 0
}

function parseDate(raw: string): Date {
  // Format: YYYY-MM-DD
  const d = new Date(raw.trim() + "T12:00:00Z")
  return isNaN(d.getTime()) ? new Date() : d
}

export function parseLekkerslaapCSV(csvContent: string): LekkerslaapParseResult {
  const lines = csvContent.split(/\r?\n/).filter(l => l.trim() !== "")
  const errors: string[] = []
  let skippedRows = 0
  let pendingBalance = 0

  // Find header
  let headerIdx = -1
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const lower = lines[i].toLowerCase()
    if (lower.includes("booking reference") && lower.includes("description") && lower.includes("amount")) {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) {
    errors.push("Header row not found")
    return { payouts: [], pendingBalance: 0, skippedRows: 0, errors }
  }

  // Accumulate booking rows by reference
  const bookingMap = new Map<string, Partial<LekkerslaapBooking> & { date: Date }>()
  const completedBookings: LekkerslaapBooking[] = []
  const payouts: LekkerslaapPayout[] = []

  // Running list of completed-but-unpaid bookings (for payout attribution)
  const unpaidBookings: LekkerslaapBooking[] = []

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const f = parseCSVLine(lines[i])
    if (f.length < 4) { skippedRows++; continue }

    const date = f[0]?.trim() ?? ""
    const bookingRef = f[1]?.trim() ?? ""
    const description = f[2]?.trim() ?? ""
    const amountRaw = f[3]?.trim() ?? ""

    // Skip balance rows
    if (description === "Opening Balance" || description === "Closing Balance") {
      if (description === "Closing Balance") {
        pendingBalance = num(f[4]?.trim() ?? "0") // Balance column
      }
      skippedRows++
      continue
    }

    const amount = num(amountRaw)
    const parsedDate = parseDate(date)

    // Payout row — no booking reference
    if (!bookingRef && description === "Payout") {
      const payoutAmount = Math.abs(amount)

      // Greedily attribute unpaid bookings to this payout
      // Sum bookings whose net matches or contributes to payout
      const attributedBookings: LekkerslaapBooking[] = []
      let remaining = payoutAmount
      const stillUnpaid: LekkerslaapBooking[] = []

      for (const booking of unpaidBookings) {
        if (remaining > 0 && Math.abs(booking.netAmount - remaining) < 0.05) {
          // Exact match — this booking alone = payout
          attributedBookings.push(booking)
          remaining = 0
        } else if (remaining > 0 && booking.netAmount <= remaining + 0.05) {
          attributedBookings.push(booking)
          remaining = +(remaining - booking.netAmount).toFixed(2)
        } else {
          stillUnpaid.push(booking)
        }
      }

      // Clear attributed; keep unattributed
      unpaidBookings.length = 0
      unpaidBookings.push(...stillUnpaid)

      payouts.push({
        payoutDate: parsedDate,
        payoutAmount,
        bankKeyword: "LEKKESLAAP",
        bookings: attributedBookings,
      })
      continue
    }

    // Booking detail rows
    if (bookingRef) {
      if (!bookingMap.has(bookingRef)) {
        bookingMap.set(bookingRef, { date: parsedDate, bookingRef })
      }
      const entry = bookingMap.get(bookingRef)!

      if (description === "Guest payment") {
        entry.guestPayment = amount
      } else if (description === "Commission") {
        entry.commission = amount  // negative
      } else if (description === "Payment handling fee") {
        entry.paymentHandlingFee = amount  // negative

        // All 3 rows collected — finalise booking
        const booking: LekkerslaapBooking = {
          bookingRef,
          date: entry.date,
          guestPayment: entry.guestPayment ?? 0,
          commission: entry.commission ?? 0,
          paymentHandlingFee: amount,
          netAmount: +(
            (entry.guestPayment ?? 0) +
            (entry.commission ?? 0) +
            amount
          ).toFixed(2),
        }
        completedBookings.push(booking)
        unpaidBookings.push(booking)
        bookingMap.delete(bookingRef)
      }
      continue
    }

    skippedRows++
  }

  return { payouts, pendingBalance, skippedRows, errors }
}
