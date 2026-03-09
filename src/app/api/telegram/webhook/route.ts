/**
 * MrCA — Telegram Staff Bot Webhook
 * POST /api/telegram/webhook
 */

import { NextRequest, NextResponse } from "next/server";
import {
  sendMessage,
  getUserByChatId,
  createLinkToken,
  buildLinkUrl,
  canViewFinance,
} from "@/lib/telegram/bot";
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
    if (!msg || !msg.text) return NextResponse.json({ ok: true });

    const chatId = msg.chat.id;
    const text   = msg.text.trim();
    const firstName = msg.from?.first_name ?? "there";

    // Strip bot username suffix (e.g. /tonight@MrCABot → /tonight)
    const cmd = text.split("@")[0].toLowerCase();

    // ── /start — registration flow ────────────────────────────────────────────
    if (cmd === "/start") {
      const existing = await getUserByChatId(chatId);
      if (existing) {
        await sendMessage(
          chatId,
          `👋 Welcome back, <b>${existing.name}</b>!\n\nYour Telegram is already linked to MrCA. Type /help to see what I can do.`
        );
        return NextResponse.json({ ok: true });
      }

      // Generate link token
      const tok = await createLinkToken(chatId);
      const url = buildLinkUrl(tok);

      await sendMessage(
        chatId,
        [
          `👋 Hey ${firstName}! Welcome to <b>MrCA Staff Bot</b>.`,
          "",
          "To get started, tap the button below to link your Telegram to your MrCA account.",
          "",
          "⏱ Link expires in <b>30 minutes</b>.",
        ].join("\n"),
        "🔗 Connect My MrCA Account",
        url
      );
      return NextResponse.json({ ok: true });
    }

    // ── All other commands require a linked account ───────────────────────────
    const user = await getUserByChatId(chatId);
    if (!user) {
      const tok = await createLinkToken(chatId);
      const url = buildLinkUrl(tok);
      await sendMessage(
        chatId,
        "⚠️ Your Telegram isn't linked to an MrCA account yet.\n\n⏱ Link expires in 30 minutes.",
        "🔗 Connect My MrCA Account",
        url
      );
      return NextResponse.json({ ok: true });
    }

    // ── Route commands ────────────────────────────────────────────────────────
    let reply: string;

    switch (cmd) {
      case "/help":
        reply = await cmdHelp(user.role);
        break;

      case "/tonight":
        reply = await cmdTonight(user.organisationId);
        break;

      case "/revenue":
        if (!canViewFinance(user.role)) {
          reply = "⛔ You don't have permission to view financial data.";
        } else {
          reply = await cmdRevenue(user.organisationId);
        }
        break;

      case "/occupancy":
        reply = await cmdOccupancy(user.organisationId);
        break;

      case "/bookings":
        reply = await cmdBookings(user.organisationId);
        break;

      case "/digest":
        if (!canViewFinance(user.role)) {
          reply = "⛔ You don't have permission to view the full digest.";
        } else {
          reply = await cmdDigest(user.organisationId);
        }
        break;

      default:
        reply = `Hey ${user.name.split(" ")[0]}! I didn't recognise that command. Type /help to see what I can do. 👋`;
    }

    await sendMessage(chatId, reply);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Telegram webhook] Error:", err);
    return NextResponse.json({ ok: true }); // always 200 to Telegram
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, service: "MrCA Telegram Staff Bot" });
}
