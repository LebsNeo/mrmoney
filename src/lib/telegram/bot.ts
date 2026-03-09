/**
 * MrCA — Telegram Bot Helpers
 */

const BASE = "https://api.telegram.org/bot";

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

/** Check if a chat ID is in the allowed list from env */
export function isAllowed(chatId: number | string): boolean {
  const allowed = process.env.TELEGRAM_ALLOWED_CHAT_IDS;
  if (!allowed) return false; // deny all if not configured
  return allowed.split(",").map((s) => s.trim()).includes(String(chatId));
}

/** Resolve which org this bot serves */
export function getOrgId(): string | null {
  return process.env.TELEGRAM_ORG_ID ?? null;
}
