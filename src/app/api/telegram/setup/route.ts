/**
 * MrCA — Telegram Webhook Registration
 * GET /api/telegram/setup?secret=<CRON_SECRET>
 *
 * Call this once after deploying to register the webhook URL with Telegram.
 * e.g. https://www.mrca.co.za/api/telegram/setup?secret=xxx
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Simple auth — reuse CRON_SECRET
  const secret = process.env.CRON_SECRET;
  if (secret && req.nextUrl.searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 500 });
  }

  // Derive webhook URL from the request host
  const host  = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "www.mrca.co.za";
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const webhookUrl = `${proto}://${host}/api/telegram/webhook`;

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ["message"],
    }),
  });

  const data = await res.json();
  console.log("[Telegram setup] setWebhook response:", data);

  if (!data.ok) {
    return NextResponse.json({ error: "Telegram rejected webhook", detail: data }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    webhookUrl,
    telegram: data,
  });
}
