import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiServerError } from "@/lib/api-response";
import { verifyEmailToken } from "@/lib/auth-tokens";
import { welcomeEmailTemplate, sendEmail } from "@/lib/email-templates";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) return apiError("Token is required");

    const email = verifyEmailToken(token);
    if (!email) return apiError("This verification link is invalid or has expired.");

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, emailVerified: true },
    });

    if (!user) return apiError("Account not found.");
    if (user.emailVerified) {
      // Already verified — treat as success (idempotent)
      return apiSuccess({ alreadyVerified: true });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    // Send welcome email (fire and forget)
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://mrmoney.vercel.app";
      const { subject, html, text } = welcomeEmailTemplate({
        name: user.name,
        dashboardUrl: `${appUrl}/dashboard`,
      });
      await sendEmail({ to: user.email, subject, html, text });
    } catch {
      // Non-fatal
    }

    logger.info("Email verified", { email });
    return apiSuccess({ verified: true });
  } catch (err) {
    logger.error("verify-email error", err);
    return apiServerError();
  }
}
