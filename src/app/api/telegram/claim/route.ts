/**
 * MrCA — Telegram Link Claim
 * POST /api/telegram/claim
 *
 * Called by TelegramConnectClient when staff confirm the link.
 * Validates token, links telegramChatId to the logged-in user, notifies bot.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/telegram/bot";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const { token } = await req.json();
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
  }

  // Validate token
  const linkToken = await prisma.telegramLinkToken.findUnique({ where: { token } });

  if (!linkToken)              return NextResponse.json({ ok: false, error: "Invalid link" }, { status: 400 });
  if (linkToken.usedAt)        return NextResponse.json({ ok: false, error: "Link already used" }, { status: 400 });
  if (new Date() > linkToken.expiresAt) return NextResponse.json({ ok: false, error: "Link expired" }, { status: 400 });

  const userId = (session.user as { id: string }).id;

  // Make sure this user isn't already linked
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramChatId: true, name: true },
  });
  if (existing?.telegramChatId) {
    return NextResponse.json({ ok: false, error: "Account already linked to Telegram" }, { status: 400 });
  }

  // Make sure chat ID isn't already claimed by another user
  const chatTaken = await prisma.user.findFirst({
    where: { telegramChatId: linkToken.chatId, deletedAt: null },
  });
  if (chatTaken) {
    return NextResponse.json({ ok: false, error: "This Telegram account is already linked to another user" }, { status: 400 });
  }

  // Link the accounts
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { telegramChatId: linkToken.chatId },
    }),
    prisma.telegramLinkToken.update({
      where: { token },
      data: { userId, usedAt: new Date() },
    }),
  ]);

  // Notify the bot — send a welcome message
  try {
    await sendMessage(
      linkToken.chatId,
      [
        `🎉 <b>You're all set, ${existing?.name ?? ""}!</b>`,
        "",
        "Your MrCA account is now connected. Here's what you can do:",
        "",
        "/tonight — Tonight's house status",
        "/bookings — Upcoming check-ins",
        "/occupancy — Current occupancy",
        "/help — Full command list",
      ].join("\n")
    );
  } catch {
    // Non-fatal — link still worked
    console.warn("[Telegram claim] Could not send welcome message");
  }

  return NextResponse.json({ ok: true });
}
