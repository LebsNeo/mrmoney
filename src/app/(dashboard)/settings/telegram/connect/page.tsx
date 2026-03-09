/**
 * MrCA — Telegram Account Link Page
 * /settings/telegram/connect?token=xxx
 *
 * Staff land here from the bot's registration link.
 * Must be logged in to MrCA. Confirms and links their Telegram chat ID.
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TelegramConnectClient } from "./TelegramConnectClient";

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function TelegramConnectPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/settings/telegram/connect");

  const { token } = await searchParams;

  if (!token) {
    return <ErrorPage message="Invalid or missing link. Please type /start in the MrCA bot to get a new one." />;
  }

  // Validate the token — raw SQL to avoid Prisma client cache issues
  const rows = await prisma.$queryRaw<
    Array<{ id: string; chat_id: string; used_at: Date | null; expires_at: Date }>
  >`SELECT id, chat_id, used_at, expires_at FROM telegram_link_tokens WHERE token = ${token} LIMIT 1`;

  if (rows.length === 0) {
    return <ErrorPage message="This link is invalid. Please type /start in the MrCA bot to get a new one." />;
  }

  const linkToken = rows[0];

  if (linkToken.used_at) {
    return <ErrorPage message="This link has already been used. Your Telegram should already be connected — type /help in the bot." />;
  }

  if (new Date() > linkToken.expires_at) {
    return <ErrorPage message="This link has expired (links are valid for 30 minutes). Please type /start in the MrCA bot to get a fresh one." />;
  }

  const userId = (session.user as { id: string }).id;

  // Check if this user already has a Telegram linked — raw SQL
  const userRows = await prisma.$queryRaw<
    Array<{ name: string; telegram_chat_id: string | null }>
  >`SELECT name, telegram_chat_id FROM users WHERE id = ${userId} LIMIT 1`;

  const currentUser = userRows[0] ?? null;

  if (currentUser?.telegram_chat_id) {
    return <ErrorPage message="Your account already has a Telegram linked. Unlink it from Settings first if you want to connect a new one." />;
  }

  return (
    <TelegramConnectClient
      token={token}
      chatId={linkToken.chat_id}
      userName={currentUser?.name ?? session.user.name ?? ""}
    />
  );
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-lg font-semibold text-white mb-3">Link Error</h1>
        <p className="text-sm text-gray-400">{message}</p>
        <a href="/settings" className="mt-6 inline-block text-xs text-emerald-400 hover:underline">
          ← Back to Settings
        </a>
      </div>
    </div>
  );
}
