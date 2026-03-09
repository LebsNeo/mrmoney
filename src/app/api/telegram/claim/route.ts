/**
 * MrCA — Telegram Link Claim
 * POST /api/telegram/claim
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/telegram/bot";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const token = body?.token;
    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
    }

    // Validate token — raw SQL
    const rows = await prisma.$queryRaw<
      Array<{ id: string; chat_id: string; used_at: Date | null; expires_at: Date }>
    >`SELECT id, chat_id, used_at, expires_at FROM telegram_link_tokens WHERE token = ${token} LIMIT 1`;

    if (rows.length === 0) return NextResponse.json({ ok: false, error: "Invalid link — send /start to the bot to get a fresh one" }, { status: 400 });

    const linkToken = rows[0];
    if (linkToken.used_at)                return NextResponse.json({ ok: false, error: "Link already used" }, { status: 400 });
    if (new Date() > linkToken.expires_at) return NextResponse.json({ ok: false, error: "Link expired — send /start again to get a new one" }, { status: 400 });

    const userId = (session.user as { id: string }).id;

    // Check this user isn't already linked
    const userRows = await prisma.$queryRaw<
      Array<{ telegram_chat_id: string | null; name: string }>
    >`SELECT telegram_chat_id, name FROM users WHERE id = ${userId} LIMIT 1`;

    const currentUser = userRows[0];
    if (currentUser?.telegram_chat_id) {
      return NextResponse.json({ ok: false, error: "Account already linked to Telegram" }, { status: 400 });
    }

    // Check chat ID isn't taken by another user
    const takenRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM users WHERE telegram_chat_id = ${linkToken.chat_id} AND "deletedAt" IS NULL LIMIT 1
    `;
    if (takenRows.length > 0) {
      return NextResponse.json({ ok: false, error: "This Telegram account is already linked to another MrCA user" }, { status: 400 });
    }

    // Link the accounts
    await prisma.$executeRaw`UPDATE users SET telegram_chat_id = ${linkToken.chat_id} WHERE id = ${userId}`;
    await prisma.$executeRaw`UPDATE telegram_link_tokens SET used_at = now(), user_id = ${userId} WHERE id = ${linkToken.id}`;

    // Send welcome message (non-fatal)
    try {
      await sendMessage(
        linkToken.chat_id,
        [
          `🎉 <b>You're all set, ${currentUser?.name ?? ""}!</b>`,
          "",
          "Your MrCA account is now connected. Try these:",
          "",
          "/tonight — Tonight's house status",
          "/bookings — Upcoming check-ins",
          "/occupancy — Current occupancy",
          "/help — Full command list",
        ].join("\n")
      );
    } catch {
      console.warn("[Telegram claim] Could not send welcome message");
    }

    return NextResponse.json({ ok: true });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Telegram claim] Unhandled error:", msg);
    return NextResponse.json(
      { ok: false, error: `DB error: ${msg}` },
      { status: 500 }
    );
  }
}
