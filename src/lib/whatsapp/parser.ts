/**
 * AI-powered booking intent extractor
 * Uses GPT-4o function calling for reliable structured output
 */

import type { BookingIntent } from "./types";

export async function extractBookingIntent(
  message: string,
  conversationHistory: string[] = []
): Promise<BookingIntent> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      checkIn: null, checkOut: null, guests: null,
      roomPreference: null, guestName: null, notes: null,
      confidence: "LOW", missingFields: ["checkIn", "checkOut"],
    };
  }

  const today = new Date().toISOString().slice(0, 10);

  const systemPrompt = `You are a booking assistant for a South African guesthouse.
Today's date is ${today}.
Extract booking details from the guest's message. Be flexible with date formats:
- "next Friday", "15 March", "15/03", "March 15" etc. are all valid
- If year is not mentioned, assume the next occurrence of that date
- "tonight" = today, "tomorrow" = tomorrow
- Convert all dates to YYYY-MM-DD format
- If only check-in is mentioned, set checkOut to null
- Detect the guest's name if they introduce themselves
- Note any room preferences (single, double, family, etc.)`;

  const tools = [
    {
      type: "function",
      function: {
        name: "extract_booking",
        description: "Extract booking details from the message",
        parameters: {
          type: "object",
          properties: {
            checkIn: { type: ["string", "null"], description: "Check-in date YYYY-MM-DD or null" },
            checkOut: { type: ["string", "null"], description: "Check-out date YYYY-MM-DD or null" },
            guests: { type: ["number", "null"], description: "Number of guests or null" },
            roomPreference: { type: ["string", "null"], description: "Room type preference or null" },
            guestName: { type: ["string", "null"], description: "Guest's name if mentioned" },
            notes: { type: ["string", "null"], description: "Any special requests or notes" },
            confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
            missingFields: {
              type: "array",
              items: { type: "string" },
              description: "Fields still needed: checkIn, checkOut, guests",
            },
            isBookingIntent: {
              type: "boolean",
              description: "True if message is about making or enquiring about a booking",
            },
          },
          required: ["checkIn", "checkOut", "confidence", "missingFields", "isBookingIntent"],
        },
      },
    },
  ];

  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.map((m, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: m,
    })),
    { role: "user", content: message },
  ];

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        tools,
        tool_choice: { type: "function", function: { name: "extract_booking" } },
        temperature: 0,
        max_tokens: 300,
      }),
    });

    const data = await res.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call returned");

    const extracted = JSON.parse(toolCall.function.arguments);
    return {
      checkIn: extracted.checkIn ?? null,
      checkOut: extracted.checkOut ?? null,
      guests: extracted.guests ?? null,
      roomPreference: extracted.roomPreference ?? null,
      guestName: extracted.guestName ?? null,
      notes: extracted.notes ?? null,
      confidence: extracted.confidence ?? "LOW",
      missingFields: extracted.missingFields ?? [],
    };
  } catch (e) {
    console.error("Booking intent extraction failed:", e);
    return {
      checkIn: null, checkOut: null, guests: null,
      roomPreference: null, guestName: null, notes: null,
      confidence: "LOW", missingFields: ["checkIn", "checkOut"],
    };
  }
}
