/**
 * MrCA WhatsApp Conversational Agent
 * GPT-4o powered with tool calling — natural, intelligent guest interactions
 * No rigid state machine. Feels like a real receptionist.
 */

import { prisma } from "@/lib/prisma";
import type { IncomingMessage } from "./types";

const CONV_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour idle → fresh conversation
const MAX_HISTORY = 24; // messages kept in context

function shortRef(): string {
  return "MM" + Math.random().toString(36).slice(2, 7).toUpperCase();
}

function fmtDate(d: string): string {
  return new Date(d + "T12:00:00Z").toLocaleDateString("en-ZA", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function handleIncomingMessage(
  msg: IncomingMessage,
  organisationId: string
): Promise<string> {
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
  if (!property) return "Hi! We're not currently taking bookings via WhatsApp. Please contact us directly.";

  const rooms = await prisma.room.findMany({
    where: { propertyId: property.id, deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true, type: true, baseRate: true, maxOccupancy: true },
    orderBy: { name: "asc" },
  });

  // ── Find / create conversation ──────────────────────────────────────────────
  let conv = await prisma.whatsAppConversation.findFirst({
    where: { organisationId, phone: msg.from },
    orderBy: { lastMessageAt: "desc" },
  });

  const isTimedOut = conv && Date.now() - conv.lastMessageAt.getTime() > CONV_TIMEOUT_MS;
  const isTerminal = conv?.state === "CONFIRMED" || conv?.state === "CANCELLED";

  if (!conv || isTimedOut || isTerminal) {
    conv = await prisma.whatsAppConversation.create({
      data: {
        organisationId,
        propertyId: property.id,
        phone: msg.from,
        guestName: msg.name !== msg.from ? msg.name : null,
        state: "COLLECTING",
        extracted: { history: [] },
      },
    });
  }

  const extracted = (conv.extracted as Record<string, unknown>) ?? {};
  const history = (extracted.history as Array<{ role: string; content: string }>) ?? [];

  // ── Build system prompt ─────────────────────────────────────────────────────
  const today = new Date().toLocaleDateString("en-ZA", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    timeZone: "Africa/Johannesburg",
  });

  const roomList = rooms.length > 0
    ? rooms.map(r => `• ${r.name} (${r.type ?? "Room"}, sleeps ${r.maxOccupancy ?? 2}, R${parseFloat(String(r.baseRate)).toFixed(0)}/night)`).join("\n")
    : "• Rooms available — ask for details";

  const systemPrompt = `You are a friendly, professional booking assistant for ${property.name}, a South African guesthouse.
Today is ${today} (SAST, UTC+2).

PROPERTY:
• Name: ${property.name}
• Phone: ${property.phone ?? "not provided"}

ROOMS:
${roomList}

POLICIES:
• Check-in: 14:00 | Check-out: 11:00
• Payment on arrival — EFT or cash
• Cancellation: free if 24h+ notice
• No smoking indoors
• Pets by arrangement — ask owner

YOUR JOB:
• Be warm, natural, helpful — like a real front desk person
• Speak South African English — friendly but professional
• Keep replies short and to the point (this is WhatsApp, not email)
• Use emojis naturally, not excessively
• Use the guest's first name once you know it
• Answer questions about the property, pricing, policies conversationally
• When you have enough info (check-in, check-out, guest count) → call check_availability
• Once guest agrees to booking details → call confirm_booking
• Don't be robotic or ask multiple questions in a row — have a real conversation
• If someone is just asking general questions (no booking intent), help them warmly
• If the guest says YES/confirm/book it after you've shown availability → call confirm_booking immediately
• Never make up room IDs — only use IDs returned from check_availability`;

  const messages: Array<{ role: string; content: unknown; tool_calls?: unknown; tool_call_id?: string }> = [
    { role: "system", content: systemPrompt },
    ...history.slice(-MAX_HISTORY),
    { role: "user", content: msg.body },
  ];

  // ── Tools ───────────────────────────────────────────────────────────────────
  const tools = [
    {
      type: "function",
      function: {
        name: "check_availability",
        description: "Check which rooms are available for given dates. Call this once you have check-in, check-out, and number of guests.",
        parameters: {
          type: "object",
          properties: {
            checkIn:  { type: "string", description: "Check-in date YYYY-MM-DD" },
            checkOut: { type: "string", description: "Check-out date YYYY-MM-DD" },
            guests:   { type: "number", description: "Number of guests" },
          },
          required: ["checkIn", "checkOut", "guests"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "confirm_booking",
        description: "Create a confirmed booking after guest agrees to all details. Only call once guest explicitly confirms.",
        parameters: {
          type: "object",
          properties: {
            checkIn:     { type: "string", description: "Check-in date YYYY-MM-DD" },
            checkOut:    { type: "string", description: "Check-out date YYYY-MM-DD" },
            guests:      { type: "number", description: "Number of guests" },
            guestName:   { type: "string", description: "Guest full name" },
            roomId:      { type: "string", description: "Room ID from check_availability result" },
            roomName:    { type: "string", description: "Room name" },
            ratePerNight:{ type: "number", description: "Rate per night in ZAR" },
          },
          required: ["checkIn", "checkOut", "guestName", "roomId", "roomName", "ratePerNight"],
        },
      },
    },
  ];

  // ── Call GPT ────────────────────────────────────────────────────────────────
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return `Hi! Thanks for messaging ${property.name}. Our booking system is temporarily unavailable — please call us${property.phone ? ` on ${property.phone}` : ""} to make a reservation.`;
  }

  try {
    let aiReply = await callGPT(apiKey, messages, tools);
    let bookingRef: string | null = null;

    // ── Handle tool calls ───────────────────────────────────────────────────
    while (aiReply.tool_calls?.length) {
      const toolMessages: Array<{ role: string; content: string; tool_call_id: string }> = [];

      for (const toolCall of aiReply.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);

        if (toolCall.function.name === "check_availability") {
          const result = await checkAvailability(property.id, args.checkIn, args.checkOut, args.guests, rooms);
          toolMessages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
        }

        if (toolCall.function.name === "confirm_booking") {
          const result = await createBooking(property.id, args, msg.from, conv.guestName ?? msg.name);
          toolMessages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
          if (result.success) bookingRef = result.ref as string;
        }
      }

      // Continue with tool results
      const continueMessages = [
        ...messages,
        { role: "assistant", content: null, tool_calls: aiReply.tool_calls },
        ...toolMessages,
      ];
      aiReply = await callGPT(apiKey, continueMessages, tools);
    }

    const replyText = typeof aiReply.content === "string" && aiReply.content.trim()
      ? aiReply.content.trim()
      : "Sorry, I didn't catch that. Could you rephrase?";

    // ── Persist history + state ─────────────────────────────────────────────
    const updatedHistory = [
      ...history.slice(-(MAX_HISTORY - 2)),
      { role: "user",      content: msg.body },
      { role: "assistant", content: replyText },
    ];

    await prisma.whatsAppConversation.update({
      where: { id: conv.id },
      data: {
        lastMessageAt: new Date(),
        guestName: conv.guestName ?? (msg.name !== msg.from ? msg.name : undefined),
        state: bookingRef ? "CONFIRMED" : conv.state,
        extracted: { ...extracted, history: updatedHistory },
      },
    });

    return replyText;
  } catch (e) {
    console.error("[WhatsApp Agent] Error:", e);
    return `Sorry, I'm having trouble right now. Please try again or call us${property.phone ? ` on ${property.phone}` : ""} directly.`;
  }
}

// ── GPT helper ────────────────────────────────────────────────────────────────

async function callGPT(
  apiKey: string,
  messages: unknown[],
  tools: unknown[]
): Promise<{ content?: string; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> }> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      tools,
      temperature: 0.75,
      max_tokens: 500,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message ?? {};
}

// ── Tool implementations ──────────────────────────────────────────────────────

async function checkAvailability(
  propertyId: string,
  checkIn: string,
  checkOut: string,
  guests: number,
  rooms: Array<{ id: string; name: string; type: string | null; baseRate: unknown; maxOccupancy: number | null }>
): Promise<unknown> {
  if (!checkIn || !checkOut) return { available: false, reason: "Missing dates" };

  const ciDate = new Date(checkIn + "T12:00:00Z");
  const coDate = new Date(checkOut + "T12:00:00Z");
  const nights = Math.round((coDate.getTime() - ciDate.getTime()) / 86400000);

  if (nights <= 0) return { available: false, reason: "Check-out must be after check-in" };

  const available = [];
  for (const room of rooms) {
    if (guests && room.maxOccupancy && room.maxOccupancy < guests) continue;
    const conflict = await prisma.booking.findFirst({
      where: {
        roomId: room.id,
        deletedAt: null,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        checkIn: { lt: coDate },
        checkOut: { gt: ciDate },
      },
    });
    if (!conflict) {
      const rate = parseFloat(String(room.baseRate));
      available.push({
        id: room.id,
        name: room.name,
        type: room.type ?? "Room",
        maxOccupancy: room.maxOccupancy ?? 2,
        ratePerNight: rate,
        totalCost: rate * nights,
      });
    }
  }

  if (available.length === 0) {
    return { available: false, reason: "No rooms available for these dates", checkIn: fmtDate(checkIn), checkOut: fmtDate(checkOut), nights };
  }

  return { available: true, rooms: available, nights, checkIn: fmtDate(checkIn), checkOut: fmtDate(checkOut) };
}

async function createBooking(
  propertyId: string,
  args: { checkIn: string; checkOut: string; guests?: number; guestName: string; roomId: string; roomName: string; ratePerNight: number },
  guestPhone: string,
  fallbackName: string
): Promise<{ success: boolean; ref?: string; checkIn?: string; error?: string }> {
  try {
    const checkIn  = new Date(args.checkIn  + "T12:00:00Z");
    const checkOut = new Date(args.checkOut + "T12:00:00Z");
    const nights   = Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000);
    const gross    = args.ratePerNight * nights;
    const ref      = shortRef();

    await prisma.booking.create({
      data: {
        propertyId,
        roomId:        args.roomId,
        source:        "WHATSAPP",
        guestName:     args.guestName || fallbackName,
        guestPhone,
        checkIn,
        checkOut,
        roomRate:      args.ratePerNight,
        grossAmount:   gross,
        otaCommission: 0,
        netAmount:     gross,
        vatRate:       0,
        vatAmount:     0,
        isVatInclusive: false,
        status:        "CONFIRMED",
        externalRef:   ref,
        notes:         `WhatsApp booking via ${guestPhone}`,
      },
    });

    return { success: true, ref, checkIn: args.checkIn };
  } catch (e) {
    console.error("[confirm_booking] Failed:", e);
    return { success: false, error: "Booking creation failed" };
  }
}
