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

    // Verify signature
    if (!provider.verifySignature(rawBody, headers)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Parse body (Twilio = form, Meta = JSON)
    let body: unknown;
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      body = Object.fromEntries(new URLSearchParams(rawBody));
    } else {
      try { body = JSON.parse(rawBody); } catch { body = {}; }
    }

    const msg = provider.parseWebhook(body, headers);

    // Always 200 to provider (even if not a user message)
    if (!msg || !msg.body.trim()) {
      return NextResponse.json({ ok: true });
    }

    // Look up which org owns this WhatsApp number
    // We use WHATSAPP_ORG_ID env var — set per deployment
    // (In future: look up by phone number in a whatsapp_settings table)
    const orgId = process.env.WHATSAPP_ORG_ID;
    if (!orgId) {
      console.error("WHATSAPP_ORG_ID not set");
      return NextResponse.json({ ok: true });
    }

    // Verify org exists
    const org = await prisma.organisation.findUnique({
      where: { id: orgId },
      select: { id: true },
    });
    if (!org) return NextResponse.json({ ok: true });

    // Process message and get reply
    const reply = await handleIncomingMessage(msg, orgId);

    // Send reply
    if (reply) {
      await provider.send({ to: msg.from, body: reply });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("WhatsApp webhook error:", err);
    // Always 200 — prevent provider from retrying
    return NextResponse.json({ ok: true });
  }
}
