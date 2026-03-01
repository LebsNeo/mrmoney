/**
 * MrMoney — WhatsApp Booking Intake
 * Provider-agnostic types
 */

export interface IncomingMessage {
  from: string        // E.164 phone number, e.g. +27821234567
  name: string        // Display name from WhatsApp profile
  body: string        // Message text
  messageId: string   // Provider message ID (for dedup)
  timestamp: Date
}

export interface OutgoingMessage {
  to: string
  body: string
}

export interface WhatsAppProvider {
  /** Parse raw webhook body into IncomingMessage, or null if not a user message */
  parseWebhook(body: unknown, headers: Record<string, string>): IncomingMessage | null
  /** Send a text message */
  send(msg: OutgoingMessage): Promise<void>
  /** Verify webhook signature (return true if valid) */
  verifySignature(body: string, headers: Record<string, string>): boolean
}

/** Extracted booking intent from AI */
export interface BookingIntent {
  checkIn: string | null       // YYYY-MM-DD
  checkOut: string | null      // YYYY-MM-DD
  guests: number | null
  roomPreference: string | null
  guestName: string | null
  notes: string | null
  confidence: "HIGH" | "MEDIUM" | "LOW"
  missingFields: string[]      // What we still need to ask for
}
