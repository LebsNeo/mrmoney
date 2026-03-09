/**
 * MrCA — Telegram Staff Bot Webhook
 * POST /api/telegram/webhook
 *
 * /start → registration flow (no auth needed)
 * /help  → command list
 * everything else → GPT agent
 */

import { NextRequest, NextResponse } from "next/server";
import {
  sendMessage,
  getUserByChatId,
  createLinkToken,
  buildLinkUrl,
  canViewFinance,
} from "@/lib/telegram/bot";
import { cmdHelp } from "@/lib/telegram/commands";
import { handleTelegramMessage } from "@/lib/telegram/agent";

export const maxDuration = 60;

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

    const chatId    = msg.chat.id;
    const text      = msg.text.trim();
    const firstName = msg.from?.first_name ?? "there";
    const cmd       = text.split("@")[0].toLowerCase();

    // ── /start — registration ─────────────────────────────────────────────────
    if (cmd === "/start") {
      const existing = await getUserByChatId(chatId);
      if (existing) {
        await sendMessage(chatId,
          `👋 Welcome back, ${existing.name}!\n\nYour account is already linked. Just talk to me naturally — ask anything about the property.\n\nOr type /help to see example commands.`
        );
        return NextResponse.json({ ok: true });
      }
      const tok = await createLinkToken(chatId);
      const url = buildLinkUrl(tok);
      await sendMessage(
        chatId,
        `👋 Hey ${firstName}! Welcome to MrCA Staff Bot.\n\nTo get started, link your Telegram to your MrCA account.\n\n⏱ Link expires in 30 minutes.`,
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

    // ── /help — show command examples ─────────────────────────────────────────
    if (cmd === "/help") {
      const helpText = [
        `🏨 MrCA Staff Bot — ${user.name}`,
        "",
        "Just talk to me naturally! Examples:",
        "",
        "• Who's checking in today?",
        "• What's our occupancy tonight?",
        "• Find booking for Sipho Dlamini",
        "• Check in guest [name]",
        "• Check out room 3",
        "• Is room 4 free this weekend?",
        "• Add note to booking [ref]: late arrival",
        "• Cancel booking for [name]",
        canViewFinance(user.role) ? "• What did we make this month?" : "",
        canViewFinance(user.role) ? "• Give me the morning digest" : "",
        "• Help me link Airbnb to Room 1",
        "• Show my iCal feeds",
        "• Sync all iCal feeds",
        "• Give me the export URL for Room 2",
        "",
        "No need for slash commands — just ask.",
      ].filter(Boolean).join("\n");

      await sendMessage(chatId, helpText);
      return NextResponse.json({ ok: true });
    }

    // ── Everything else → GPT agent ───────────────────────────────────────────
    // Show typing indicator feel — send immediately after processing
    const reply = await handleTelegramMessage(user, text);
    await sendMessage(chatId, reply);
    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error("[Telegram webhook] Error:", err);
    return NextResponse.json({ ok: true });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, service: "MrCA Telegram Staff Bot" });
}
