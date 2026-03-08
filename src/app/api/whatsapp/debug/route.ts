import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleIncomingMessage } from "@/lib/whatsapp/engine";

export async function GET() {
  try {
    const orgId = process.env.WHATSAPP_ORG_ID;
    if (!orgId) return NextResponse.json({ error: "WHATSAPP_ORG_ID not set" }, { status: 500 });

    const org = await prisma.organisation.findUnique({ where: { id: orgId }, select: { id: true, name: true } });
    const property = await prisma.property.findFirst({
      where: { organisationId: orgId, isActive: true, deletedAt: null },
      select: { id: true, name: true, phone: true },
    });

    // Simulate an incoming message
    const reply = await handleIncomingMessage({
      from: "+27754786858",
      name: "Lebs",
      body: "I want to book 2 guests from 10 March to 12 March",
      messageId: "debug-001",
      timestamp: new Date(),
    }, orgId);

    // Test actual send
    const token = process.env.WHATSAPP_ACCESS_TOKEN ?? "";
    const phoneId = process.env.WHATSAPP_PHONE_ID ?? "";
    let sendResult: unknown = "skipped";
    if (token && phoneId) {
      const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: "27624382564", type: "text", text: { body: "DEBUG TEST: bot send check ✅" } }),
      });
      sendResult = await res.json();
    }

    return NextResponse.json({
      org, property, reply, orgId,
      tokenLen: token.length,
      tokenPrefix: token.slice(0, 10),
      phoneId,
      sendResult,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err), stack: (err as Error).stack }, { status: 500 });
  }
}
