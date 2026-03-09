import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [cols, tokens] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{column_name: string}>>(
        `SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name LIKE 'telegram%'`
      ),
      prisma.$queryRawUnsafe<Array<{token: string; chat_id: string; used_at: unknown; expires_at: unknown}>>(
        `SELECT token, chat_id, used_at, expires_at FROM telegram_link_tokens ORDER BY created_at DESC LIMIT 3`
      ),
    ]);
    return NextResponse.json({ cols, tokens });
  } catch (err) {
    return NextResponse.json({ error: String(err) });
  }
}
