"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { compare, hash } from "bcryptjs";

export async function updatePassword(
  currentPassword: string,
  newPassword: string
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { success: false, message: "Not authenticated" };
    }

    const userId = (session.user as any).id as string;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { success: false, message: "User not found" };
    }

    const isValid = await compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return { success: false, message: "Current password is incorrect" };
    }

    if (newPassword.length < 8) {
      return { success: false, message: "New password must be at least 8 characters" };
    }

    const newHash = await hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return { success: true, message: "Password updated successfully" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: msg };
  }
}
