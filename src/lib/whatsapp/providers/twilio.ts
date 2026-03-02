/**
 * Twilio WhatsApp provider
 * Docs: https://www.twilio.com/docs/whatsapp
 *
 * Env vars:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_WHATSAPP_FROM   — e.g. whatsapp:+14155238886
 */

import { createHmac } from "crypto";
import type { WhatsAppProvider, IncomingMessage, OutgoingMessage } from "../types";

export const TwilioProvider: WhatsAppProvider = {
  parseWebhook(body: unknown): IncomingMessage | null {
    try {
      // Twilio sends URL-encoded form data, parsed as object
      const b = body as Record<string, string>;
      if (!b?.From?.startsWith("whatsapp:")) return null;

      return {
        from: b.From.replace("whatsapp:", ""),
        name: b.ProfileName ?? b.From.replace("whatsapp:", ""),
        body: b.Body ?? "",
        messageId: b.MessageSid ?? "",
        timestamp: new Date(),
      };
    } catch {
      return null;
    }
  },

  async send(msg: OutgoingMessage): Promise<void> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886";
    if (!sid || !token) throw new Error("Twilio env vars not set");

    const to = `whatsapp:${msg.to}`;
    const params = new URLSearchParams({ From: from, To: to, Body: msg.body });

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Twilio send failed: ${err}`);
    }
  },

  verifySignature(body: string, headers: Record<string, string>, url?: string): boolean {
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!token) return true;
    const sig = headers["x-twilio-signature"] ?? "";
    if (!sig) return true; // no signature header = local dev / testing
    // Twilio signature: HMAC-SHA1 of full URL + sorted POST params concatenated
    const webhookUrl = url ?? `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/whatsapp/webhook`;
    const params = Object.fromEntries(new URLSearchParams(body));
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((s, k) => s + k + params[k], webhookUrl);
    const expected = createHmac("sha1", token).update(sortedParams).digest("base64");
    return sig === expected;
  },
};
