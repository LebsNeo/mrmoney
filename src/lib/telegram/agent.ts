/**
 * MrCA — Telegram Staff Agent
 * GPT-4o-mini with tool calling — acts like a knowledgeable employee.
 * Understands natural language, executes real actions, respects role permissions.
 */

import { prisma } from "@/lib/prisma";
import { canViewFinance, type TelegramUser } from "@/lib/telegram/bot";
import { UserRole } from "@prisma/client";

const CONV_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour idle → fresh context
const MAX_HISTORY = 20;

// ── Entry point ───────────────────────────────────────────────────────────────

export async function handleTelegramMessage(
  user: TelegramUser,
  text: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "⚠️ AI is not configured. Use /help for manual commands.";

  // Load org + properties context
  const org = await prisma.organisation.findUnique({
    where: { id: user.organisationId },
    select: { name: true },
  });

  const properties = await prisma.property.findMany({
    where: { organisationId: user.organisationId, isActive: true, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Load/create conversation
  const { history, convId } = await loadConversation(user.id);

  const saDate = new Date().toLocaleString("en-ZA", {
    timeZone: "Africa/Johannesburg",
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const propList = properties.map(p => `• ${p.name} (id: ${p.id})`).join("\n");
  const financeNote = canViewFinance(user.role)
    ? "You can access financial data (revenue, digest, cash flow)."
    : "You do NOT have access to financial data — politely decline if asked.";

  const systemPrompt = `You are the MrCA Staff Assistant — an intelligent, helpful property management agent.
You work for ${org?.name ?? "the property"}.

TODAY: ${saDate} (South Africa, SAST UTC+2)

STAFF MEMBER: ${user.name} | Role: ${user.role}
${financeNote}

PROPERTIES:
${propList || "• No active properties"}

YOUR PERSONALITY:
• Concise — this is Telegram, not email. Short punchy answers.
• Proactive — if someone asks about a guest, show all relevant details
• Professional but warm — you're a colleague, not a robot
• Use emojis naturally but sparingly
• Always respond in plain text (no markdown like ** or ##)
• Use line breaks to structure multi-line answers

YOUR CAPABILITIES:
• Look up tonight's house, occupancy, upcoming bookings
• Find and look up specific guests/bookings
• Check in and check out guests
• Check room availability
• Add notes to bookings
• Cancel bookings (with confirmation)
${canViewFinance(user.role) ? "• Revenue queries, financial digest" : ""}

RULES:
• Never make up data — always use tools to get real information
• For destructive actions (cancel, check-out), confirm with the user first unless they explicitly say "yes confirm" or "do it"
• If unsure what property to use and there are multiple, ask which one
• Keep responses under 300 characters when possible`;

  const messages: unknown[] = [
    { role: "system", content: systemPrompt },
    ...history.slice(-MAX_HISTORY),
    { role: "user", content: text },
  ];

  const tools = buildTools(user.role, properties.map(p => p.id));

  try {
    let reply = await runAgent(apiKey, messages, tools, user, properties);

    // Save conversation
    const updatedHistory = [
      ...history.slice(-(MAX_HISTORY - 2)),
      { role: "user", content: text },
      { role: "assistant", content: reply },
    ];
    await saveConversation(user.id, convId, updatedHistory);

    return reply;
  } catch (e) {
    console.error("[TelegramAgent] Error:", e);
    return "Something went wrong on my end. Try again or use /help for manual commands.";
  }
}

// ── Agent loop ────────────────────────────────────────────────────────────────

async function runAgent(
  apiKey: string,
  messages: unknown[],
  tools: unknown[],
  user: TelegramUser,
  properties: Array<{ id: string; name: string }>
): Promise<string> {
  const MAX_TOOL_ROUNDS = 5;
  let currentMessages = [...messages];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await callGPT(apiKey, currentMessages, tools);

    if (!response.tool_calls?.length) {
      return (typeof response.content === "string" && response.content.trim())
        ? response.content.trim()
        : "Done.";
    }

    // Execute tools
    const toolResults: unknown[] = [];
    for (const tc of response.tool_calls) {
      const args = JSON.parse(tc.function.arguments);
      const result = await executeTool(tc.function.name, args, user, properties);
      toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
    }

    currentMessages = [
      ...currentMessages,
      { role: "assistant", content: response.content ?? null, tool_calls: response.tool_calls },
      ...toolResults,
    ];
  }

  return "I've completed the requested actions.";
}

// ── Tool definitions ──────────────────────────────────────────────────────────

function buildTools(role: UserRole, propertyIds: string[]): unknown[] {
  const tools: unknown[] = [
    {
      type: "function",
      function: {
        name: "get_tonight",
        description: "Get tonight's house — who is arriving, in-house, and departing today. Use for 'tonight', 'today', 'who's in', 'house status'.",
        parameters: {
          type: "object",
          properties: {
            propertyId: { type: "string", description: "Property ID. Use first property if only one." },
          },
          required: ["propertyId"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_occupancy",
        description: "Get current occupancy rate across all or a specific property.",
        parameters: {
          type: "object",
          properties: {
            propertyId: { type: "string", description: "Optional: specific property ID. Omit for all." },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_upcoming_bookings",
        description: "Get upcoming confirmed bookings. Use for 'upcoming', 'next bookings', 'who's coming'.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Number of bookings to return (default 5, max 10)" },
            propertyId: { type: "string", description: "Optional: filter by property ID" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "look_up_booking",
        description: "Find a specific booking by guest name, booking reference, or date. Use when staff asks about a specific guest.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Guest name, reference number, or keyword to search" },
          },
          required: ["query"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "check_availability",
        description: "Check which rooms are available for given dates.",
        parameters: {
          type: "object",
          properties: {
            propertyId: { type: "string", description: "Property ID to check" },
            checkIn: { type: "string", description: "Check-in date YYYY-MM-DD" },
            checkOut: { type: "string", description: "Check-out date YYYY-MM-DD" },
          },
          required: ["propertyId", "checkIn", "checkOut"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "check_in_guest",
        description: "Check in a guest — updates booking status to CHECKED_IN. Confirm with user before doing this.",
        parameters: {
          type: "object",
          properties: {
            bookingId: { type: "string", description: "Booking ID to check in" },
            confirmed: { type: "boolean", description: "True if user has confirmed the action" },
          },
          required: ["bookingId", "confirmed"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "check_out_guest",
        description: "Check out a guest — updates booking status to CHECKED_OUT. Confirm with user before doing this.",
        parameters: {
          type: "object",
          properties: {
            bookingId: { type: "string", description: "Booking ID to check out" },
            confirmed: { type: "boolean", description: "True if user has confirmed the action" },
          },
          required: ["bookingId", "confirmed"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "add_booking_note",
        description: "Add a note to a booking.",
        parameters: {
          type: "object",
          properties: {
            bookingId: { type: "string", description: "Booking ID" },
            note: { type: "string", description: "Note text to append" },
          },
          required: ["bookingId", "note"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "cancel_booking",
        description: "Cancel a booking. Always confirm with the user before cancelling.",
        parameters: {
          type: "object",
          properties: {
            bookingId: { type: "string", description: "Booking ID to cancel" },
            confirmed: { type: "boolean", description: "True if user has explicitly confirmed cancellation" },
          },
          required: ["bookingId", "confirmed"],
        },
      },
    },
  ];

  if (canViewFinance(role)) {
    tools.push({
      type: "function",
      function: {
        name: "get_revenue",
        description: "Get revenue for a time period. Use for 'revenue', 'income', 'how much did we make'.",
        parameters: {
          type: "object",
          properties: {
            period: {
              type: "string",
              enum: ["today", "yesterday", "this_week", "this_month", "last_month"],
              description: "Time period",
            },
          },
          required: ["period"],
        },
      },
    });

    tools.push({
      type: "function",
      function: {
        name: "get_digest",
        description: "Get the full morning digest — occupancy, revenue, arrivals, departures summary.",
        parameters: { type: "object", properties: {} },
      },
    });
  }

  return tools;
}

// ── Tool execution ────────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  user: TelegramUser,
  properties: Array<{ id: string; name: string }>
): Promise<unknown> {
  const orgId = user.organisationId;
  const firstPropId = properties[0]?.id;

  try {
    switch (name) {

      case "get_tonight": {
        const propId = (args.propertyId as string) || firstPropId;
        if (!propId) return { error: "No property found" };
        const { start, end, label } = todayRange();
        const prop = properties.find(p => p.id === propId);

        const [arriving, inHouse, departing, totalRooms] = await Promise.all([
          prisma.booking.findMany({
            where: { propertyId: propId, deletedAt: null, status: { in: ["CONFIRMED", "CHECKED_IN"] }, checkIn: { gte: start, lte: end } },
            select: { id: true, guestName: true, room: { select: { name: true } }, checkIn: true, checkOut: true },
          }),
          prisma.booking.findMany({
            where: { propertyId: propId, deletedAt: null, status: { in: ["CONFIRMED", "CHECKED_IN"] }, checkIn: { lt: start }, checkOut: { gt: end } },
            select: { id: true, guestName: true, room: { select: { name: true } }, checkIn: true, checkOut: true },
          }),
          prisma.booking.findMany({
            where: { propertyId: propId, deletedAt: null, status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] }, checkOut: { gte: start, lte: end } },
            select: { id: true, guestName: true, room: { select: { name: true } }, checkOut: true },
          }),
          prisma.room.count({ where: { propertyId: propId, deletedAt: null, status: "ACTIVE" } }),
        ]);

        return {
          property: prop?.name,
          date: label,
          totalRooms,
          occupied: arriving.length + inHouse.length,
          arriving: arriving.map(b => ({ id: b.id, guest: b.guestName, room: b.room?.name })),
          inHouse: inHouse.map(b => ({ id: b.id, guest: b.guestName, room: b.room?.name })),
          departing: departing.map(b => ({ id: b.id, guest: b.guestName, room: b.room?.name })),
        };
      }

      case "get_occupancy": {
        const { start, end } = todayRange();
        const props = args.propertyId
          ? properties.filter(p => p.id === args.propertyId)
          : properties;

        const results = await Promise.all(props.map(async (prop) => {
          const [total, occupied] = await Promise.all([
            prisma.room.count({ where: { propertyId: prop.id, deletedAt: null, status: "ACTIVE" } }),
            prisma.booking.count({
              where: { propertyId: prop.id, deletedAt: null, status: { in: ["CONFIRMED", "CHECKED_IN"] }, checkIn: { lte: end }, checkOut: { gt: start } },
            }),
          ]);
          return { property: prop.name, total, occupied, pct: total > 0 ? Math.round((occupied / total) * 100) : 0 };
        }));

        return { occupancy: results };
      }

      case "get_upcoming_bookings": {
        const limit = Math.min(Number(args.limit) || 5, 10);
        const where: Record<string, unknown> = {
          property: { organisationId: orgId },
          deletedAt: null,
          status: { in: ["CONFIRMED"] },
          checkIn: { gte: new Date() },
        };
        if (args.propertyId) where.propertyId = args.propertyId;

        const bookings = await prisma.booking.findMany({
          where,
          orderBy: { checkIn: "asc" },
          take: limit,
          include: {
            property: { select: { name: true } },
            room: { select: { name: true } },
          },
        });

        return bookings.map(b => ({
          id: b.id,
          guest: b.guestName,
          phone: b.guestPhone,
          property: b.property.name,
          room: b.room?.name,
          checkIn: b.checkIn.toISOString().split("T")[0],
          checkOut: b.checkOut.toISOString().split("T")[0],
          nights: Math.round((b.checkOut.getTime() - b.checkIn.getTime()) / 86400000),
          amount: Number(b.grossAmount),
          source: b.source,
          status: b.status,
        }));
      }

      case "look_up_booking": {
        const q = String(args.query ?? "").toLowerCase().trim();
        const bookings = await prisma.booking.findMany({
          where: {
            property: { organisationId: orgId },
            deletedAt: null,
            OR: [
              { guestName: { contains: q, mode: "insensitive" } },
              { externalRef: { contains: q, mode: "insensitive" } },
              { guestPhone: { contains: q } },
            ],
          },
          orderBy: { checkIn: "desc" },
          take: 5,
          include: { property: { select: { name: true } }, room: { select: { name: true } } },
        });

        if (bookings.length === 0) return { found: false, message: `No bookings found matching "${args.query}"` };

        return {
          found: true,
          bookings: bookings.map(b => ({
            id: b.id,
            guest: b.guestName,
            phone: b.guestPhone,
            email: b.guestEmail,
            property: b.property.name,
            room: b.room?.name,
            checkIn: b.checkIn.toISOString().split("T")[0],
            checkOut: b.checkOut.toISOString().split("T")[0],
            status: b.status,
            amount: Number(b.grossAmount),
            notes: b.notes,
            source: b.source,
            ref: b.externalRef,
          })),
        };
      }

      case "check_availability": {
        const propId = (args.propertyId as string) || firstPropId;
        const checkIn  = new Date((args.checkIn as string) + "T12:00:00Z");
        const checkOut = new Date((args.checkOut as string) + "T12:00:00Z");
        const nights   = Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000);
        if (nights <= 0) return { error: "Check-out must be after check-in" };

        const rooms = await prisma.room.findMany({
          where: { propertyId: propId, deletedAt: null, status: "ACTIVE" },
          select: { id: true, name: true, type: true, baseRate: true, maxOccupancy: true },
        });

        const available = [];
        for (const r of rooms) {
          const conflict = await prisma.booking.findFirst({
            where: { roomId: r.id, deletedAt: null, status: { notIn: ["CANCELLED", "NO_SHOW"] }, checkIn: { lt: checkOut }, checkOut: { gt: checkIn } },
          });
          if (!conflict) available.push({ id: r.id, name: r.name, type: r.type, maxOccupancy: r.maxOccupancy, ratePerNight: Number(r.baseRate), totalCost: Number(r.baseRate) * nights });
        }

        const prop = properties.find(p => p.id === propId);
        return { property: prop?.name, checkIn: args.checkIn, checkOut: args.checkOut, nights, availableRooms: available };
      }

      case "check_in_guest": {
        if (!args.confirmed) return { needsConfirmation: true, message: "Please confirm you want to check in this guest." };
        const booking = await prisma.booking.findFirst({
          where: { id: args.bookingId as string, property: { organisationId: orgId }, deletedAt: null },
          include: { room: { select: { name: true } } },
        });
        if (!booking) return { error: "Booking not found" };
        if (booking.status === "CHECKED_IN") return { error: `${booking.guestName} is already checked in` };

        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: "CHECKED_IN" },
        });
        return { success: true, message: `✅ ${booking.guestName} checked in to ${booking.room?.name ?? "their room"}` };
      }

      case "check_out_guest": {
        if (!args.confirmed) return { needsConfirmation: true, message: "Please confirm you want to check out this guest." };
        const booking = await prisma.booking.findFirst({
          where: { id: args.bookingId as string, property: { organisationId: orgId }, deletedAt: null },
          include: { room: { select: { name: true } } },
        });
        if (!booking) return { error: "Booking not found" };
        if (booking.status === "CHECKED_OUT") return { error: `${booking.guestName} already checked out` };

        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: "CHECKED_OUT" },
        });
        return { success: true, message: `✅ ${booking.guestName} checked out of ${booking.room?.name ?? "their room"}` };
      }

      case "add_booking_note": {
        const booking = await prisma.booking.findFirst({
          where: { id: args.bookingId as string, property: { organisationId: orgId }, deletedAt: null },
        });
        if (!booking) return { error: "Booking not found" };

        const existing = booking.notes ? booking.notes + "\n" : "";
        const ts = new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", dateStyle: "short", timeStyle: "short" });
        await prisma.booking.update({
          where: { id: booking.id },
          data: { notes: `${existing}[${ts}] ${args.note}` },
        });
        return { success: true, message: "Note added to booking" };
      }

      case "cancel_booking": {
        if (!args.confirmed) return { needsConfirmation: true, message: "Are you sure you want to cancel this booking? Reply 'yes cancel it' to confirm." };
        const booking = await prisma.booking.findFirst({
          where: { id: args.bookingId as string, property: { organisationId: orgId }, deletedAt: null },
        });
        if (!booking) return { error: "Booking not found" };
        if (booking.status === "CANCELLED") return { error: "Booking is already cancelled" };

        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: "CANCELLED" },
        });
        return { success: true, message: `❌ Booking for ${booking.guestName} has been cancelled` };
      }

      case "get_revenue": {
        if (!canViewFinance(user.role)) return { error: "No permission" };
        const { start, end } = getRevenuePeriod(args.period as string);
        const result = await prisma.transaction.aggregate({
          _sum: { amount: true },
          where: { organisationId: orgId, deletedAt: null, type: "INCOME", date: { gte: start, lte: end } },
        });
        const expenses = await prisma.transaction.aggregate({
          _sum: { amount: true },
          where: { organisationId: orgId, deletedAt: null, type: "EXPENSE", date: { gte: start, lte: end } },
        });
        const income = Number(result._sum.amount ?? 0);
        const expense = Number(expenses._sum.amount ?? 0);
        return { period: args.period, income, expenses: expense, net: income - expense };
      }

      case "get_digest": {
        if (!canViewFinance(user.role)) return { error: "No permission" };
        const { buildDigest, formatDigestMessage } = await import("@/lib/whatsapp/daily-digest");
        const data = await buildDigest(orgId);
        if (!data) return { error: "No digest data available" };
        return { digest: formatDigestMessage(data) };
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[TelegramAgent] Tool ${name} error:`, msg);
    return { error: msg };
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
    body: JSON.stringify({ model: "gpt-4o-mini", messages, tools, temperature: 0.4, max_tokens: 600 }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message ?? {};
}

// ── Conversation persistence ──────────────────────────────────────────────────

async function loadConversation(userId: string): Promise<{ history: Array<{ role: string; content: string }>; convId: string | null }> {
  try {
    const rows = await prisma.$queryRaw<Array<{ id: string; history: unknown; last_message_at: Date }>>`
      SELECT id, history, last_message_at FROM telegram_conversations WHERE user_id = ${userId} LIMIT 1
    `;
    if (!rows.length) return { history: [], convId: null };

    const row = rows[0];
    const isStale = Date.now() - row.last_message_at.getTime() > CONV_TIMEOUT_MS;
    if (isStale) {
      await prisma.$executeRaw`UPDATE telegram_conversations SET history = '[]', last_message_at = now() WHERE id = ${row.id}`;
      return { history: [], convId: row.id };
    }
    return { history: (row.history as Array<{ role: string; content: string }>) ?? [], convId: row.id };
  } catch {
    return { history: [], convId: null };
  }
}

async function saveConversation(userId: string, convId: string | null, history: unknown[]): Promise<void> {
  const json = JSON.stringify(history);
  try {
    if (convId) {
      await prisma.$executeRaw`UPDATE telegram_conversations SET history = ${json}::jsonb, last_message_at = now() WHERE id = ${convId}`;
    } else {
      await prisma.$executeRaw`
        INSERT INTO telegram_conversations (user_id, history) VALUES (${userId}, ${json}::jsonb)
        ON CONFLICT (user_id) DO UPDATE SET history = ${json}::jsonb, last_message_at = now()
      `;
    }
  } catch (e) {
    console.warn("[TelegramAgent] Could not save conversation:", e);
  }
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayRange() {
  const sa = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Johannesburg" }));
  const start = new Date(sa); start.setHours(0, 0, 0, 0);
  const end   = new Date(sa); end.setHours(23, 59, 59, 999);
  const label = sa.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" });
  return { start, end, label, sa };
}

function getRevenuePeriod(period: string): { start: Date; end: Date } {
  const sa = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Johannesburg" }));
  const today = new Date(sa); today.setHours(0, 0, 0, 0);
  const endToday = new Date(sa); endToday.setHours(23, 59, 59, 999);

  switch (period) {
    case "today":      return { start: today, end: endToday };
    case "yesterday": {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      const ye = new Date(y); ye.setHours(23, 59, 59, 999);
      return { start: y, end: ye };
    }
    case "this_week": {
      const w = new Date(today); w.setDate(w.getDate() - w.getDay());
      return { start: w, end: endToday };
    }
    case "this_month": {
      const m = new Date(sa.getFullYear(), sa.getMonth(), 1);
      return { start: m, end: endToday };
    }
    case "last_month": {
      const lm = new Date(sa.getFullYear(), sa.getMonth() - 1, 1);
      const lme = new Date(sa.getFullYear(), sa.getMonth(), 0, 23, 59, 59, 999);
      return { start: lm, end: lme };
    }
    default: return { start: today, end: endToday };
  }
}
