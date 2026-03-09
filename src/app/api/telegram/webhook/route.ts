/**
 * MrCA — Telegram Staff Bot Webhook
 * POST /api/telegram/webhook
 *
 * Handles incoming Telegram updates (text commands from staff/owner).
 * Security: only chat IDs in TELEGRAM_ALLOWED_CHAT_IDS env var are served.
 */

import { NextRequest, NextResponse } from "next/server";
import { sendMessage, isAllowed, getOrgId } from "@/lib/telegram/bot";
import {
  cmdHelp,
  cmdTonight,
  cmdRevenue,
  cmdOccupancy,
  cmdBookings,
  cmdDigest,
} from "@/lib/telegram/commands";

export const maxDuration = 30;

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
    date: number;
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const update: TelegramUpdate = await req.json();
    const msg = update.message;

    // Ignore non-text and non-message updates
    if (!msg || !msg.text) return NextResponse.json({ ok: true });

    const chatId   = msg.chat.id;
    const text     = msg.text.trim();
    const name     = msg.from?.first_name ?? "there";

    // ── Security: only allow configured chat IDs ──────────────────────────────
    if (!isAllowed(chatId)) {
      console.warn(`[Telegram] Unauthorised chat_id: ${chatId}`);
      await sendMessage(chatId, "⛔ You are not authorised to use this bot.");
      return NextResponse.json({ ok: true });
    }

    // ── Resolve org ───────────────────────────────────────────────────────────
    const orgId = getOrgId();
    if (!orgId) {
      await sendMessage(chatId, "⚠️ Bot not configured — TELEGRAM_ORG_ID missing.");
      return NextResponse.json({ ok: true });
    }

    // ── Route commands ────────────────────────────────────────────────────────
    // Strip bot username suffix (e.g. /tonight@MrCABot → /tonight)
    const cmd = text.split("@")[0].toLowerCase();

    let reply: string;

    switch (cmd) {
      case "/start":
      case "/help":
        reply = await cmdHelp();
        break;

      case "/tonight":
        reply = await cmdTonight(orgId);
        break;

      case "/revenue":
        reply = await cmdRevenue(orgId);
        break;

      case "/occupancy":
        reply = await cmdOccupancy(orgId);
        break;

      case "/bookings":
        reply = await cmdBookings(orgId);
        break;

      case "/digest":
        reply = await cmdDigest(orgId);
        break;

      default:
        // Friendly fallback
        reply = `Hey ${name}! I didn't recognise that command. Type /help to see what I can do. 👋`;
    }

    await sendMessage(chatId, reply);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Telegram webhook] Error:", err);
    return NextResponse.json({ ok: true }); // always 200 to Telegram
  }
}

// ── GET: health check / verify endpoint exists ────────────────────────────────
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, service: "MrCA Telegram Staff Bot" });
}
