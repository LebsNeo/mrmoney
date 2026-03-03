import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildDigest, formatDigestMessage } from "@/lib/whatsapp/daily-digest";
import { MetaProvider } from "@/lib/whatsapp/providers/meta";
import { TwilioProvider } from "@/lib/whatsapp/providers/twilio";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = (session.user as { organisationId?: string })?.organisationId;
  if (!orgId) return NextResponse.json({ error: "No organisation" }, { status: 400 });

  const { phone } = await req.json().catch(() => ({}));

  // Get org details
  const org = await prisma.organisation.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, ownerWhatsApp: true },
  });

  const toPhone = phone || org?.ownerWhatsApp;

  if (!toPhone) {
    return NextResponse.json({
      ok: false,
      error: "No WhatsApp number saved. Please save your phone number first.",
    }, { status: 400 });
  }

  // Validate phone format
  const cleaned = toPhone.replace(/\s+/g, "").replace(/^0/, "+27");
  if (!cleaned.startsWith("+")) {
    return NextResponse.json({
      ok: false,
      error: "Phone number must include country code (e.g. +27 82 000 0000)",
    }, { status: 400 });
  }

  try {
    // Build digest — force send regardless of time
    const data = await buildDigest(orgId);

    let message: string;
    if (!data) {
      // Send a basic test message if no data
      message = `👋 *MrCA Test Message*\n\nHi! Your WhatsApp digest is connected and working. You'll receive your daily financial summary at your configured time.\n\n_Powered by MrCA · mrca.co.za_`;
    } else {
      message = formatDigestMessage(data);
    }

    const provider = process.env.TWILIO_ACCOUNT_SID ? TwilioProvider : MetaProvider;

    // For Twilio sandbox, user must have joined first
    await provider.send({ to: cleaned, body: message });

    return NextResponse.json({
      ok: true,
      message: "Test message sent! Check your WhatsApp.",
      phone: cleaned,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("Test digest failed:", err);

    // Give helpful error messages
    let userMessage = error;
    if (error.includes("not a valid WhatsApp")) {
      userMessage = "This number is not registered on WhatsApp. Please check the number.";
    } else if (error.includes("sandbox") || error.includes("not opted in")) {
      userMessage = `For Twilio sandbox: First send "join extra-gave" to +1 415 523 8886 on WhatsApp, then try again.`;
    } else if (error.includes("unsubscribed") || error.includes("opted out")) {
      userMessage = "This number has opted out of messages. Send 'START' to the WhatsApp number to re-enable.";
    }

    return NextResponse.json({ ok: false, error: userMessage }, { status: 500 });
  }
}
