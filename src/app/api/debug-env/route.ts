import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL ?? "NOT SET",
    RESEND_API_KEY_SET: !!process.env.RESEND_API_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
}
