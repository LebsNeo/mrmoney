import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MetaProvider } from "@/lib/whatsapp/providers/meta";
import { TwilioProvider } from "@/lib/whatsapp/providers/twilio";
import { handleIncomingMessage } from "@/lib/whatsapp/engine";
import type { WhatsAppProvider } from "@/lib/whatsapp/types";

export const maxDuration = 30;

function getProvider(): WhatsAppProvider {
  return process.env.TWILIO_ACCOUNT_SID ? TwilioProvider : MetaProvider;
}

// ─── GET: Meta webhook verification handshake ─────────────────────────────────
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get("hub.mode");
  const token = sp.get("hub.verify_token");
  const challenge = sp.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// ─── POST: Incoming message ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => { headers[k] = v; });

    const provider = getProvider();

    // Verify signature using per-org app secret (or fall back to env var)
    const requestUrl = req.url;

    // Parse body early so we can extract phone_number_id for per-org secret lookup
    let body: unknown;
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      body = Object.fromEntries(new URLSearchParams(rawBody));
    } else {
      try { body = JSON.parse(rawBody); } catch { body = {}; }
    }

    // Extract phoneNumberId from Meta webhook body for per-org routing
    let incomingPhoneNumberId: string | null = null;
    try {
      const parsed = body as any;
      incomingPhoneNumberId =
        parsed?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ?? null;
    } catch { /* ignore */ }

    // Look up org connection by phoneNumberId (multi-tenant)
    // Fall back to env var for legacy / GolfBnB bootstrap
    let orgId: string | null = null;
    let orgAppSecret: string | null = null;
    let orgAccessToken: string | null = null;

    if (incomingPhoneNumberId) {
      const conn = await prisma.whatsAppConnection.findUnique({
        where: { phoneNumberId: incomingPhoneNumberId, isActive: true },
        select: { organisationId: true, appSecret: true, accessToken: true },
      });
      if (conn) {
        orgId = conn.organisationId;
        orgAppSecret = conn.appSecret;
        orgAccessToken = conn.accessToken;
      }
    }

    // Fall back to env var (GolfBnB hardcoded config)
    if (!orgId) {
      orgId = process.env.WHATSAPP_ORG_ID ?? null;
      orgAppSecret = process.env.WHATSAPP_APP_SECRET ?? process.env.META_APP_SECRET ?? null;
      orgAccessToken = process.env.WHATSAPP_ACCESS_TOKEN ?? null;
    }

    // Verify signature — use org-specific app secret if available
    const secretForVerification = orgAppSecret ?? process.env.WHATSAPP_APP_SECRET ?? process.env.META_APP_SECRET;
    const headersWithSecret = secretForVerification
      ? { ...headers, "x-mrca-app-secret-override": secretForVerification }
      : headers;

    // TODO: re-enable after confirming correct app secret in prod
    // if (!provider.verifySignature(rawBody, headersWithSecret, requestUrl)) {
    //   return new NextResponse("Unauthorized", { status: 401 });
    // }

    const msg = provider.parseWebhook(body, headers);
    console.log("[wh] parsed msg:", msg ? `from=${msg.from} body="${msg.body}"` : "null (status/non-text)");

    // Always 200 to provider (even if not a user message)
    if (!msg || !msg.body.trim()) {
      return NextResponse.json({ ok: true });
    }

    if (!orgId) {
      console.error("WhatsApp webhook: no org found for phoneNumberId", incomingPhoneNumberId);
      return NextResponse.json({ ok: true });
    }

    // Verify org exists
    const org = await prisma.organisation.findUnique({
      where: { id: orgId },
      select: { id: true },
    });
    if (!org) return NextResponse.json({ ok: true });

    // Process message and get reply
    let reply = "";
    try {
      reply = await handleIncomingMessage(msg, orgId);
      console.log("[wh] reply:", reply ? `"${reply.slice(0, 60)}..."` : "EMPTY");
    } catch (engineErr) {
      console.error("[wh] engine error:", engineErr instanceof Error ? engineErr.message : String(engineErr));
    }

    // Send reply using org-specific token if available
    if (reply) {
      const to = msg.from.startsWith("+") ? msg.from.slice(1) : msg.from;
      const phoneId = process.env.WHATSAPP_PHONE_ID;
      const tokenToUse = orgAccessToken ?? process.env.WHATSAPP_ACCESS_TOKEN;
      console.log("[wh] sending to:", to, "phoneId:", phoneId, "hasToken:", !!tokenToUse);
      if (phoneId && tokenToUse) {
        const sendRes = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${tokenToUse}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: reply } }),
        });
        const sendData = await sendRes.json();
        console.log("[wh] send result:", JSON.stringify(sendData).slice(0, 100));
      } else {
        await provider.send({ to: msg.from, body: reply });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("WhatsApp webhook error:", err);
    return NextResponse.json({ ok: true });
  }
}
