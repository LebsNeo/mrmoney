import { NextResponse } from "next/server";
import { handleIncomingMessage } from "@/lib/whatsapp/engine";

export async function GET() {
  try {
    const reply = await handleIncomingMessage(
      {
        from: "+27624382564",
        name: "Lebs",
        body: "hi",
        messageId: "test-123",
        timestamp: new Date(),
      },
      "5f33601d-cc1a-417f-a82d-f6f83782fc51"
    );
    return NextResponse.json({ ok: true, reply: reply || "EMPTY" });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) });
  }
}
