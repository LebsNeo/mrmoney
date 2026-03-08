"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function getOrgId() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as any)?.organisationId as string | undefined;
  if (!orgId) throw new Error("Unauthorised");
  return orgId;
}

export async function saveWhatsAppConnection(input: {
  phoneNumberId: string;
  accessToken: string;
  wabaId: string;
  displayPhone: string;
  appSecret?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const orgId = await getOrgId();

    const existingWa = await prisma.whatsAppConnection.findFirst({
      where: { OR: [{ phoneNumberId: input.phoneNumberId.trim() }, { organisationId: orgId }] },
    });
    if (existingWa) {
      await prisma.whatsAppConnection.update({
        where: { id: existingWa.id },
        data: {
          organisationId: orgId,
          phoneNumberId: input.phoneNumberId.trim(),
          accessToken: input.accessToken.trim(),
          wabaId: input.wabaId.trim(),
          displayPhone: input.displayPhone.trim(),
          ...(input.appSecret?.trim() ? { appSecret: input.appSecret.trim() } : {}),
          isActive: true,
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.whatsAppConnection.create({
        data: {
          organisationId: orgId,
          phoneNumberId: input.phoneNumberId.trim(),
          accessToken: input.accessToken.trim(),
          wabaId: input.wabaId.trim(),
          displayPhone: input.displayPhone.trim(),
          appSecret: input.appSecret?.trim() || null,
          isActive: true,
        },
      });
    }

    revalidatePath("/settings/whatsapp");
    return { ok: true };
  } catch (err) {
    console.error("saveWhatsAppConnection error:", err);
    return { ok: false, error: "Failed to save connection" };
  }
}

export async function deleteWhatsAppConnection(): Promise<{ ok: boolean }> {
  try {
    const orgId = await getOrgId();
    await prisma.whatsAppConnection.deleteMany({ where: { organisationId: orgId } });
    revalidatePath("/settings/whatsapp");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
