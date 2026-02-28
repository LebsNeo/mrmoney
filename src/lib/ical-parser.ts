/**
 * MrMoney — iCal Parser
 * Parses VCALENDAR/VEVENT feeds from Booking.com, Airbnb, and Lekkerslaap.
 * Returns structured booking events ready for DB insert.
 */

export type ICalPlatform = "BOOKING_COM" | "AIRBNB" | "LEKKERSLAAP" | "EXPEDIA" | "DIRECT";

export interface ParsedICalEvent {
  uid: string;
  checkIn: Date;
  checkOut: Date;
  summary: string;
  description: string;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  referenceCode: string | null;
  isBooking: boolean;   // false = blocked/unavailable slot (no guest)
  platform: ICalPlatform;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Unfold iCal lines (continuation lines start with whitespace) */
function unfold(raw: string): string {
  return raw.replace(/\r?\n[ \t]/g, "");
}

/** Parse DATE or DATETIME value → Date at midnight local */
function parseICalDate(val: string): Date | null {
  // Strip tzid params: DTSTART;TZID=Africa/Johannesburg:20260701T140000
  const clean = val.replace(/^.*:/, "").trim();
  if (clean.length === 8) {
    // DATE: YYYYMMDD
    const y = parseInt(clean.slice(0, 4));
    const m = parseInt(clean.slice(4, 6)) - 1;
    const d = parseInt(clean.slice(6, 8));
    return new Date(y, m, d);
  }
  if (clean.length >= 15) {
    // DATETIME: YYYYMMDDTHHmmss[Z]
    const y = parseInt(clean.slice(0, 4));
    const mo = parseInt(clean.slice(4, 6)) - 1;
    const d = parseInt(clean.slice(6, 8));
    return new Date(y, mo, d);
  }
  return null;
}

/** Extract a single VEVENT block's property */
function prop(block: string, key: string): string {
  const re = new RegExp(`^${key}[^:]*:(.*)$`, "im");
  const m = block.match(re);
  return m ? m[1].trim() : "";
}

// ─── Platform detectors ──────────────────────────────────────────────────────

function detectPlatform(calendar: string): ICalPlatform {
  const prodId = (calendar.match(/PRODID:(.+)/i)?.[1] ?? "").toLowerCase();
  if (prodId.includes("booking.com")) return "BOOKING_COM";
  if (prodId.includes("airbnb")) return "AIRBNB";
  if (prodId.includes("sabre") || calendar.includes("lekkeslaap.co.za")) return "LEKKERSLAAP";
  if (prodId.includes("expedia")) return "EXPEDIA";
  return "DIRECT";
}

// ─── Platform-specific event parsers ─────────────────────────────────────────

function parseBookingComEvent(block: string): Partial<ParsedICalEvent> {
  // Booking.com only provides blocked dates — no guest info
  return {
    isBooking: true, // treat as booking (room is occupied)
    guestName: "Booking.com Guest",
    guestEmail: null,
    guestPhone: null,
    referenceCode: null,
  };
}

function parseAirbnbEvent(block: string, summary: string): Partial<ParsedICalEvent> {
  const desc = prop(block, "DESCRIPTION").replace(/\\n/g, "\n");
  const isReservation = summary.toLowerCase().includes("reserved");
  
  // Extract last 4 digits of phone if present
  const phoneMatch = desc.match(/Phone Number \(Last 4 Digits\):\s*(\d+)/i);
  const phone = phoneMatch ? `****${phoneMatch[1]}` : null;
  
  // Extract reservation code from URL
  const urlMatch = desc.match(/\/reservations\/details\/([A-Z0-9]+)/i);
  const refCode = urlMatch ? urlMatch[1] : null;

  return {
    isBooking: isReservation,
    guestName: isReservation ? "Airbnb Guest" : null,
    guestEmail: null,
    guestPhone: phone,
    referenceCode: refCode,
  };
}

function parseLekkerslaapEvent(block: string, desc: string): Partial<ParsedICalEvent> {
  if (desc.toUpperCase().includes("BLOCKED")) {
    return { isBooking: false, guestName: null, guestEmail: null, guestPhone: null, referenceCode: null };
  }

  // Summary format: "Reference: LS-5Q22QK \nCustomer: Name \nEmail: x \nCell: y"
  const summary = prop(block, "SUMMARY").replace(/\\n/g, "\n");
  const refMatch = summary.match(/Reference:\s*([A-Z0-9-]+)/i);
  const nameMatch = summary.match(/Customer:\s*(.+?)(?:\n|$)/i);
  const emailMatch = summary.match(/Email:\s*(.+?)(?:\n|$)/i);
  const cellMatch = summary.match(/Cell:\s*(.+?)(?:\n|$)/i);

  return {
    isBooking: true,
    guestName: nameMatch?.[1]?.trim() ?? "Lekkerslaap Guest",
    guestEmail: emailMatch?.[1]?.trim() ?? null,
    guestPhone: cellMatch?.[1]?.trim() ?? null,
    referenceCode: refMatch?.[1]?.trim() ?? null,
  };
}

// ─── Main parser ─────────────────────────────────────────────────────────────

export function parseICalFeed(raw: string, platform?: ICalPlatform): ParsedICalEvent[] {
  const unfolded = unfold(raw);
  const detectedPlatform = platform ?? detectPlatform(unfolded);

  // Split into VEVENT blocks
  const blocks = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/gi) ?? [];
  const events: ParsedICalEvent[] = [];

  for (const block of blocks) {
    const uid = prop(block, "UID");
    const dtstart = prop(block, "DTSTART");
    const dtend = prop(block, "DTEND");
    const summary = prop(block, "SUMMARY").replace(/\\n/g, " ").replace(/\\/g, "");
    const description = prop(block, "DESCRIPTION").replace(/\\n/g, "\n").replace(/\\/g, "");

    const checkIn = parseICalDate(dtstart);
    const checkOut = parseICalDate(dtend);

    if (!uid || !checkIn || !checkOut) continue;
    if (checkOut <= checkIn) continue;

    let extra: Partial<ParsedICalEvent>;

    switch (detectedPlatform) {
      case "AIRBNB":
        extra = parseAirbnbEvent(block, summary);
        break;
      case "LEKKERSLAAP":
        extra = parseLekkerslaapEvent(block, description);
        break;
      case "BOOKING_COM":
      default:
        extra = parseBookingComEvent(block);
        break;
    }

    if (extra.isBooking === false) continue; // skip pure blocks

    events.push({
      uid,
      checkIn,
      checkOut,
      summary,
      description,
      platform: detectedPlatform,
      guestName: null,
      guestEmail: null,
      guestPhone: null,
      referenceCode: null,
      isBooking: true,
      ...extra,
    });
  }

  return events;
}
