import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { signResetToken } from "@/lib/auth-tokens";
import { apiSuccess, apiError, apiServerError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email?.trim()) return apiError("Email is required");

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, name: true, email: true },
    });

    // Always return success (don't reveal whether email exists)
    if (!user) {
      return apiSuccess({ sent: true });
    }

    const token = signResetToken(user.email);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://mrmoney.vercel.app";
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
          to: user.email,
          subject: "Reset your MrMoney password",
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;">
              <h2 style="color:#10b981;margin-bottom:8px;">MrMoney</h2>
              <p>Hi ${user.name},</p>
              <p>We received a request to reset your password. Click the button below — this link expires in <strong>1 hour</strong>.</p>
              <div style="text-align:center;margin:32px 0;">
                <a href="${resetUrl}" style="background:#10b981;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
                  Reset Password
                </a>
              </div>
              <p style="color:#6b7280;font-size:13px;">If you didn't request this, ignore this email — your password won't change.</p>
              <p style="color:#6b7280;font-size:12px;margin-top:24px;">Or copy this link: ${resetUrl}</p>
            </div>
          `,
        }),
      });
    }

    logger.info("Password reset requested", { email: user.email });
    return apiSuccess({ sent: true });
  } catch (err) {
    logger.error("forgot-password error", err);
    return apiServerError();
  }
}
