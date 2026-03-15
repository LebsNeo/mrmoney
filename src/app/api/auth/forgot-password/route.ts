import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { signResetToken } from "@/lib/auth-tokens";
import { apiSuccess, apiError, apiServerError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { passwordResetEmailTemplate, sendEmail } from "@/lib/email-templates";

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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.mrca.co.za";
    const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;

    const { subject, html, text } = passwordResetEmailTemplate({
      name: user.name,
      resetUrl,
    });

    await sendEmail({ to: user.email, subject, html, text });

    logger.info("Password reset requested", { email: user.email });
    return apiSuccess({ sent: true });
  } catch (err) {
    logger.error("forgot-password error", err);
    return apiServerError();
  }
}
