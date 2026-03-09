import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

    const userId = (session.user as { id: string }).id;
    await prisma.$executeRaw`UPDATE users SET telegram_chat_id = NULL WHERE id = ${userId}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Telegram unlink]", err);
    return NextResponse.json({ ok: false, error: "Failed to unlink" }, { status: 500 });
  }
}
