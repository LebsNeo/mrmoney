import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiServerError } from "@/lib/api-response";
import { signVerifyToken } from "@/lib/auth-tokens";
import { verifyEmailTemplate, sendEmail } from "@/lib/email-templates";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return apiError("Email is required");

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, name: true, email: true, emailVerified: true },
    });

    // Always return success — don't reveal if email exists
    if (!user || user.emailVerified) {
      return apiSuccess({ sent: true });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://mrmoney.vercel.app";
    const token = signVerifyToken(user.email);
    const verifyUrl = `${appUrl}/verify-email?token=${encodeURIComponent(token)}`;

    const { subject, html, text } = verifyEmailTemplate({
      name: user.name,
      verifyUrl,
      expiryHours: 72,
    });

    await sendEmail({ to: user.email, subject, html, text });

    logger.info("Verification email resent", { email: user.email });
    return apiSuccess({ sent: true });
  } catch (err) {
    logger.error("resend-verification error", err);
    return apiServerError();
  }
}
