/**
 * MrMoney WhatsApp Booking Engine
 * Conversation state machine: COLLECTING → CONFIRMING → CONFIRMED / CANCELLED
 */

import { prisma } from "@/lib/prisma";
import { extractBookingIntent } from "./parser";
import {
  replyAskMissing,
  replyConfirmation,
  replyConfirmed,
  replyCancelled,
  replyNoAvailability,
  replyUnrecognised,
} from "./replies";
import type { IncomingMessage } from "./types";

const CONFIRM_KEYWORDS = ["yes", "ja", "yep", "confirm", "book it", "ok", "okay", "sure", "go ahead", "confirmed"];
const CANCEL_KEYWORDS = ["no", "nee", "cancel", "nope", "don't", "dont", "stop"];
const CONV_TIMEOUT_MS = 30 * 60 * 1000; // 30 min idle = restart conversation

function shortRef(): string {
  return "MM" + Math.random().toString(36).slice(2, 7).toUpperCase();
}

function isConfirm(text: string): boolean {
  return CONFIRM_KEYWORDS.some((k) => text.toLowerCase().trim().startsWith(k));
}

function isCancel(text: string): boolean {
  return CANCEL_KEYWORDS.some((k) => text.toLowerCase().trim().startsWith(k));
}

export async function handleIncomingMessage(
  msg: IncomingMessage,
  organisationId: string
): Promise<string> {
  // Load org + default property
  const org = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: { id: true, name: true },
  });
  if (!org) return "";

  const property = await prisma.property.findFirst({
    where: { organisationId, isActive: true, deletedAt: null },
    select: { id: true, name: true, phone: true },
    orderBy: { name: "asc" },
  });
  if (!property) return replyUnrecognised("our guesthouse");

  // Find or create conversation
  let conv = await prisma.whatsAppConversation.findFirst({
    where: { organisationId, phone: msg.from },
    orderBy: { lastMessageAt: "desc" },
  });

  const isTimedOut = conv && Date.now() - conv.lastMessageAt.getTime() > CONV_TIMEOUT_MS;
  const isTerminal = conv?.state === "CONFIRMED" || conv?.state === "CANCELLED";

  // Reset conversation if timed out or in terminal state
  if (!conv || isTimedOut || isTerminal) {
    conv = await prisma.whatsAppConversation.create({
      data: {
        organisationId,
        propertyId: property.id,
        phone: msg.from,
        guestName: msg.name !== msg.from ? msg.name : null,
        state: "COLLECTING",
      },
    });
  }

  // Update last message time
  await prisma.whatsAppConversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: new Date() },
  });

  // ── CONFIRMING state: expecting YES or NO ──────────────────────────────────
  if (conv.state === "CONFIRMING") {
    if (isCancel(msg.body)) {
      await prisma.whatsAppConversation.update({
        where: { id: conv.id },
        data: { state: "CANCELLED" },
      });
      return replyCancelled(conv.guestName);
    }

    if (isConfirm(msg.body)) {
      const extracted = conv.extracted as {
        checkIn: string; checkOut: string; guests: number | null;
        roomId: string; roomName: string; ratePerNight: number;
        bookingRef: string;
      } | null;

      if (!extracted?.checkIn || !extracted?.checkOut || !extracted?.roomId) {
        await prisma.whatsAppConversation.update({
          where: { id: conv.id },
          data: { state: "COLLECTING" },
        });
        return replyAskMissing(["checkIn", "checkOut"], conv.guestName, property.name);
      }

      // Create the booking
      try {
        const checkIn = new Date(extracted.checkIn + "T12:00:00Z");
        const checkOut = new Date(extracted.checkOut + "T12:00:00Z");
        const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000);
        const grossAmount = extracted.ratePerNight * nights;

        const booking = await prisma.booking.create({
          data: {
            propertyId: property.id,
            roomId: extracted.roomId,
            source: "WHATSAPP",
            guestName: conv.guestName ?? msg.name,
            guestPhone: msg.from,
            checkIn,
            checkOut,
            roomRate: extracted.ratePerNight,
            grossAmount,
            otaCommission: 0,
            netAmount: grossAmount,
            vatRate: 0,
            vatAmount: 0,
            isVatInclusive: false,
            status: "CONFIRMED",
            externalRef: extracted.bookingRef,
            notes: `WhatsApp booking via ${msg.from}`,
          },
        });

        await prisma.whatsAppConversation.update({
          where: { id: conv.id },
          data: { state: "CONFIRMED", bookingId: booking.id },
        });

        return replyConfirmed(
          conv.guestName ?? msg.name,
          extracted.checkIn,
          extracted.bookingRef,
          property.name,
          property.phone
        );
      } catch (e) {
        console.error("Booking creation failed:", e);
        return "Sorry, something went wrong creating your booking. Please call us directly to confirm.";
      }
    }

    // Not a clear YES/NO — re-send summary and ask again
    const extracted = conv.extracted as {
      checkIn: string; checkOut: string; guests: number | null;
      roomName: string; ratePerNight: number; bookingRef: string;
    } | null;
    if (extracted?.checkIn && extracted?.checkOut) {
      return (
        replyConfirmation(
          { checkIn: extracted.checkIn, checkOut: extracted.checkOut, guests: extracted.guests, roomPreference: null, guestName: conv.guestName, notes: null, confidence: "HIGH", missingFields: [] },
          extracted.roomName,
          extracted.ratePerNight,
          property.name,
          extracted.bookingRef
        ) + "\n\nReply YES to confirm or NO to cancel."
      );
    }
  }

  // ── COLLECTING state: extract intent from message ─────────────────────────
  const intent = await extractBookingIntent(msg.body);

  // Update guest name if we got one
  if (intent.guestName && !conv.guestName) {
    await prisma.whatsAppConversation.update({
      where: { id: conv.id },
      data: { guestName: intent.guestName },
    });
    conv = { ...conv, guestName: intent.guestName };
  }

  // Not a booking intent at all
  if (!intent.checkIn && !intent.checkOut && intent.confidence === "LOW") {
    return replyUnrecognised(property.name);
  }

  // Still missing required fields — ask for them
  if (intent.missingFields.length > 0) {
    return replyAskMissing(intent.missingFields, conv.guestName, property.name);
  }

  // We have dates — check availability
  const checkIn = new Date(intent.checkIn! + "T12:00:00Z");
  const checkOut = new Date(intent.checkOut! + "T12:00:00Z");

  const rooms = await prisma.room.findMany({
    where: { propertyId: property.id, deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true, type: true, baseRate: true },
    orderBy: { name: "asc" },
  });

  // Find first available room
  let selectedRoom = null;
  for (const room of rooms) {
    const conflict = await prisma.booking.findFirst({
      where: {
        roomId: room.id,
        deletedAt: null,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
      select: { id: true },
    });
    if (!conflict) { selectedRoom = room; break; }
  }

  if (!selectedRoom) {
    return replyNoAvailability(intent.checkIn!, intent.checkOut!, property.name, property.phone);
  }

  const ratePerNight = parseFloat(String(selectedRoom.baseRate));
  const bookingRef = shortRef();

  // Save extracted intent + move to CONFIRMING
  await prisma.whatsAppConversation.update({
    where: { id: conv.id },
    data: {
      state: "CONFIRMING",
      extracted: {
        checkIn: intent.checkIn,
        checkOut: intent.checkOut,
        guests: intent.guests ?? 1,
        roomId: selectedRoom.id,
        roomName: selectedRoom.name,
        ratePerNight,
        bookingRef,
        notes: intent.notes,
      },
    },
  });

  return replyConfirmation(intent, selectedRoom.name, ratePerNight, property.name, bookingRef);
}
