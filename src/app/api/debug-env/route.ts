import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL ?? "NOT SET",
    RESEND_API_KEY_SET: !!process.env.RESEND_API_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ? process.env.TWILIO_ACCOUNT_SID.slice(0, 8) + "..." : "NOT SET",
    TWILIO_AUTH_TOKEN_SET: !!process.env.TWILIO_AUTH_TOKEN,
    TWILIO_WHATSAPP_FROM: process.env.TWILIO_WHATSAPP_FROM ?? "NOT SET",
    WHATSAPP_PROVIDER: process.env.TWILIO_ACCOUNT_SID ? "twilio" : "meta",
  });
}
