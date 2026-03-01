/**
 * Meta Cloud API provider (WhatsApp Business Platform)
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Env vars:
 *   WHATSAPP_ACCESS_TOKEN   — permanent system user token
 *   WHATSAPP_PHONE_ID       — phone number ID from Meta dashboard
 *   WHATSAPP_VERIFY_TOKEN   — arbitrary string set when registering webhook
 *   WHATSAPP_APP_SECRET     — app secret for signature verification
 */

import { createHmac } from "crypto";
import type { WhatsAppProvider, IncomingMessage, OutgoingMessage } from "../types";

export const MetaProvider: WhatsAppProvider = {
  parseWebhook(body: unknown): IncomingMessage | null {
    try {
      const b = body as {
        object?: string;
        entry?: Array<{
          changes?: Array<{
            value?: {
              messages?: Array<{
                id: string;
                from: string;
                type: string;
                text?: { body: string };
                timestamp: string;
              }>;
              contacts?: Array<{ profile: { name: string }; wa_id: string }>;
            };
          }>;
        }>;
      };

      if (b?.object !== "whatsapp_business_account") return null;

      const change = b?.entry?.[0]?.changes?.[0]?.value;
      const msg = change?.messages?.[0];
      if (!msg || msg.type !== "text") return null;

      const contact = change?.contacts?.find((c) => c.wa_id === msg.from);

      return {
        from: `+${msg.from}`,
        name: contact?.profile?.name ?? msg.from,
        body: msg.text?.body ?? "",
        messageId: msg.id,
        timestamp: new Date(parseInt(msg.timestamp) * 1000),
      };
    } catch {
      return null;
    }
  },

  async send(msg: OutgoingMessage): Promise<void> {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    if (!token || !phoneId) throw new Error("Meta WhatsApp env vars not set");

    const to = msg.to.startsWith("+") ? msg.to.slice(1) : msg.to;

    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: msg.body },
        }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Meta send failed: ${err}`);
    }
  },

  verifySignature(body: string, headers: Record<string, string>): boolean {
    const secret = process.env.WHATSAPP_APP_SECRET;
    if (!secret) return true; // Skip in dev
    const sig = headers["x-hub-signature-256"] ?? "";
    const expected = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
    return sig === expected;
  },
};
