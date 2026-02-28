import { NextRequest } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyResetToken } from "@/lib/auth-tokens";
import { apiSuccess, apiError, apiServerError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) return apiError("Token and password are required");
    if (password.length < 8) return apiError("Password must be at least 8 characters");

    const email = verifyResetToken(token);
    if (!email) return apiError("Reset link is invalid or has expired. Please request a new one.");

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return apiError("Account not found");

    const passwordHash = await hash(password, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    logger.info("Password reset completed", { email });
    return apiSuccess({ reset: true });
  } catch (err) {
    logger.error("reset-password error", err);
    return apiServerError();
  }
}
