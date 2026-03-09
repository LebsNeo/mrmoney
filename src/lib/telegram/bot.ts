/**
 * MrCA — Telegram Bot Helpers
 */

import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import crypto from "crypto";

const BASE = "https://api.telegram.org/bot";

// ── Role helpers ──────────────────────────────────────────────────────────────

const FINANCE_ROLES: UserRole[] = [UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT];

export function canViewFinance(role: UserRole): boolean {
  return FINANCE_ROLES.includes(role);
}

export function buildLinkUrl(tok: string): string {
  const base = process.env.NEXTAUTH_URL ?? "https://www.mrca.co.za";
  return `${base}/settings/telegram/connect?token=${tok}`;
}

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN not set");
  return t;
}

export async function sendMessage(chatId: number | string, text: string): Promise<void> {
  await fetch(`${BASE}${token()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
}

// ── User resolution ───────────────────────────────────────────────────────────

export interface TelegramUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organisationId: string;
  telegramChatId: string | null;
}

/** Look up a MrCA user by their Telegram chat ID */
export async function getUserByChatId(chatId: number | string): Promise<TelegramUser | null> {
  const user = await prisma.user.findFirst({
    where: {
      telegramChatId: String(chatId),
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      organisationId: true,
      telegramChatId: true,
    },
  });
  return user;
}

// ── Link token management ─────────────────────────────────────────────────────

const TOKEN_EXPIRY_MINUTES = 30;

/** Create a one-time link token for a given Telegram chat ID */
export async function createLinkToken(chatId: number | string): Promise<string> {
  const rawToken = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

  // Clean up any existing unused tokens for this chatId
  await prisma.$executeRawUnsafe(
    `DELETE FROM telegram_link_tokens WHERE chat_id = $1 AND used_at IS NULL`,
    String(chatId)
  );

  await prisma.$executeRawUnsafe(
    `INSERT INTO telegram_link_tokens (id, chat_id, token, expires_at)
     VALUES (gen_random_uuid()::text, $1, $2, $3)`,
    String(chatId),
    rawToken,
    expiresAt
  );

  return rawToken;
}

/** Claim a link token — links the chatId to the given userId */
export async function claimLinkToken(
  token: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; chat_id: string; used_at: Date | null; expires_at: Date }>
  >`SELECT id, chat_id, used_at, expires_at FROM telegram_link_tokens WHERE token = ${token}`;

  if (rows.length === 0) return { ok: false, error: "Invalid or expired link. Generate a new one from the bot." };

  const row = rows[0];
  if (row.used_at) return { ok: false, error: "This link has already been used." };
  if (new Date() > row.expires_at) return { ok: false, error: "Link expired. Send /start to the bot again." };

  // Save chatId to user
  await prisma.$executeRawUnsafe(
    `UPDATE users SET telegram_chat_id = $1 WHERE id = $2`,
    row.chat_id,
    userId
  );

  // Mark token as used
  await prisma.$executeRawUnsafe(
    `UPDATE telegram_link_tokens SET used_at = now(), user_id = $1 WHERE id = $2`,
    userId,
    row.id
  );

  return { ok: true };
}

/** Remove a user's Telegram link */
export async function unlinkTelegram(userId: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE users SET telegram_chat_id = NULL WHERE id = $1`,
    userId
  );
}
