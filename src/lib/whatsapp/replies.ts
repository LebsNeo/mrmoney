/**
 * WhatsApp reply message templates
 * Plain text only — no markdown. Emojis for structure.
 */

import type { BookingIntent } from "./types";

const fmt = (d: string) => {
  const date = new Date(d + "T12:00:00Z");
  return date.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
};

const nights = (ci: string, co: string) => {
  const diff = new Date(co + "T12:00:00Z").getTime() - new Date(ci + "T12:00:00Z").getTime();
  return Math.round(diff / 86400000);
};

export function replyAskMissing(missing: string[], guestName?: string | null, propertyName = "our guesthouse"): string {
  const name = guestName ? `Hi ${guestName.split(" ")[0]}! ` : "Hi there! ";
  const questions: string[] = [];

  if (missing.includes("checkIn")) questions.push("What date would you like to check in? (e.g. 15 March)");
  if (missing.includes("checkOut") && !missing.includes("checkIn")) questions.push("And what date will you check out?");
  if (missing.includes("guests")) questions.push("How many guests?");

  if (questions.length === 0) {
    return `${name}Thanks for reaching out to ${propertyName}! Could you tell me:\n\n- Your check-in date\n- Your check-out date\n- Number of guests\n\nWe'll check availability right away 🏠`;
  }

  return `${name}Thanks for your interest in ${propertyName}!\n\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nWe'll confirm availability as soon as you reply 😊`;
}

export function replyConfirmation(
  intent: BookingIntent,
  roomName: string,
  ratePerNight: number,
  propertyName: string,
  bookingRef: string
): string {
  const n = nights(intent.checkIn!, intent.checkOut!);
  const total = ratePerNight * n;

  return `🏠 *${propertyName}* — Booking Request

📅 Check-in:  ${fmt(intent.checkIn!)}
📅 Check-out: ${fmt(intent.checkOut!)}
🌙 Nights:    ${n}
🛏 Room:      ${roomName}
👥 Guests:    ${intent.guests ?? 1}
💰 Total:     R${total.toLocaleString("en-ZA")}

${intent.notes ? `📝 Notes: ${intent.notes}\n` : ""}
Ref: ${bookingRef}

Reply *YES* to confirm this booking.
Reply *NO* to cancel.

Payment on arrival. EFT or cash accepted.`;
}

export function replyConfirmed(
  guestName: string,
  checkIn: string,
  bookingRef: string,
  propertyName: string,
  propertyPhone?: string | null
): string {
  const firstName = guestName.split(" ")[0];
  return `✅ Booking confirmed, ${firstName}!

Your stay at *${propertyName}* is locked in.

📅 Check-in: ${fmt(checkIn)}
🔖 Ref: ${bookingRef}

We'll see you then! If you need to make any changes, reply to this message${propertyPhone ? ` or call ${propertyPhone}` : ""}.

Safe travels 🚗`;
}

export function replyCancelled(guestName?: string | null): string {
  const name = guestName ? `${guestName.split(" ")[0]}, no` : "No";
  return `${name} problem! Your booking request has been cancelled.\n\nFeel free to message us any time if you'd like to book in the future 🙂`;
}

export function replyNoAvailability(
  checkIn: string,
  checkOut: string,
  propertyName: string,
  propertyPhone?: string | null
): string {
  const n = nights(checkIn, checkOut);
  return `😔 Sorry, we don't have availability for ${fmt(checkIn)} – ${fmt(checkOut)} (${n} nights) at ${propertyName}.\n\nPlease try different dates or call us directly${propertyPhone ? ` on ${propertyPhone}` : ""} for alternatives.`;
}

export function replyUnrecognised(propertyName: string): string {
  return `Hi! Thanks for messaging ${propertyName} 🏠\n\nTo check availability and make a booking, just tell us:\n- Your desired check-in date\n- Check-out date\n- Number of guests\n\nExample: "I'd like to book 2 nights from 20 March for 2 people"\n\nWe'll get back to you right away!`;
}
