/**
 * Airbnb Earnings CSV Parser
 *
 * Format (from Airbnb Earnings → Download CSV):
 *   Date, Type, Confirmation Code, Booking date, Start date, End date,
 *   Nights, Guest, Listing, Details, Reference code, Currency, Amount,
 *   Paid out, Service fee, Fast Pay Fee, Cleaning fee, Gross earnings,
 *   Occupancy taxes, Earnings year
 *
 * Date format: MM/DD/YYYY
 *
 * Model A — Per Booking:
 *   Each "Reservation" row = one payout to bank
 *   Date     = payout date (when money deposits)
 *   Amount   = net amount received in bank
 *   Service fee = Airbnb's fee (positive in file, deducted from gross)
 *   Gross earnings = what guest paid
 *
 * Bank matching:
 *   amount ≈ Amount column (exact)  +  date ± 3 days  +  "AIRBNB" in description
 *
 * Other row types:
 *   Cancellation Fee → skip (or record as negative if needed)
 *   Payout           → aggregate payout row (rare in this format)
 *   Resolution       → skip
 */

export interface AirbnbPayout {
  payoutDate: Date
  confirmationCode: string    // e.g. HMYKHMDZM2 — booking reference
  bookingDate: Date
  checkIn: Date
  checkOut: Date
  nights: number
  guestName: string
  listing: string
  currency: string
  netAmount: number           // Amount column — what hits bank
  serviceFee: number          // Airbnb fee (positive value)
  cleaningFee: number
  grossEarnings: number
  type: string                // Reservation | Cancellation Fee | Payout
}

export interface AirbnbParseResult {
  payouts: AirbnbPayout[]
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
  if (!raw || raw.trim() === "" || raw.trim() === "-") return 0
  return parseFloat(raw.replace(/[^0-9.\-]/g, "")) || 0
}

/** Parse MM/DD/YYYY → Date at noon UTC */
function parseMMDDYYYY(raw: string): Date {
  const parts = raw.trim().split("/")
  if (parts.length !== 3) return new Date()
  const [mm, dd, yyyy] = parts
  const d = new Date(`${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T12:00:00Z`)
  return isNaN(d.getTime()) ? new Date() : d
}

export function parseAirbnbCSV(csvContent: string): AirbnbParseResult {
  const lines = csvContent.split(/\r?\n/).filter(l => l.trim() !== "")
  const payouts: AirbnbPayout[] = []
  const errors: string[] = []
  let skippedRows = 0

  // Find header row
  let headerIdx = -1
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const lower = lines[i].toLowerCase()
    if (lower.includes("confirmation code") && lower.includes("amount") && lower.includes("guest")) {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) {
    errors.push("Header row not found")
    return { payouts: [], skippedRows: 0, errors }
  }

  const headers = parseCSVLine(lines[headerIdx]).map(h => h.toLowerCase().trim())
  const col = (name: string) => headers.indexOf(name)

  const C = {
    date:           col("date"),
    type:           col("type"),
    confirmCode:    col("confirmation code"),
    bookingDate:    col("booking date"),
    startDate:      col("start date"),
    endDate:        col("end date"),
    nights:         col("nights"),
    guest:          col("guest"),
    listing:        col("listing"),
    currency:       col("currency"),
    amount:         col("amount"),
    paidOut:        col("paid out"),
    serviceFee:     col("service fee"),
    cleaningFee:    col("cleaning fee"),
    grossEarnings:  col("gross earnings"),
  }

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    const f = parseCSVLine(line)
    const type = (f[C.type] ?? "").trim()

    // Only process Reservation rows (and Payout rows if they appear)
    if (type !== "Reservation" && type !== "Payout") {
      skippedRows++
      continue
    }

    const netAmount = num(f[C.amount])
    if (netAmount === 0) { skippedRows++; continue }

    payouts.push({
      payoutDate:      parseMMDDYYYY(f[C.date] ?? ""),
      confirmationCode: (f[C.confirmCode] ?? "").trim(),
      bookingDate:     parseMMDDYYYY(f[C.bookingDate] ?? ""),
      checkIn:         parseMMDDYYYY(f[C.startDate] ?? ""),
      checkOut:        parseMMDDYYYY(f[C.endDate] ?? ""),
      nights:          parseInt(f[C.nights] ?? "1") || 1,
      guestName:       (f[C.guest] ?? "").trim(),
      listing:         (f[C.listing] ?? "").trim(),
      currency:        (f[C.currency] ?? "ZAR").trim(),
      netAmount:       Math.abs(netAmount),
      serviceFee:      Math.abs(num(f[C.serviceFee])),
      cleaningFee:     Math.abs(num(f[C.cleaningFee])),
      grossEarnings:   Math.abs(num(f[C.grossEarnings])),
      type,
    })
  }

  return { payouts, skippedRows, errors }
}
