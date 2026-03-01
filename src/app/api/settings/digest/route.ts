import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, apiUnauthorized } from "@/lib/api-response";

export async function GET() {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organisationId?: string })?.organisationId;
  if (!orgId) return apiUnauthorized();

  const org = await prisma.organisation.findUnique({
    where: { id: orgId },
    select: { ownerWhatsApp: true, digestEnabled: true, digestTime: true },
  });
  if (!org) return apiError("Org not found", 404);
  return apiSuccess(org);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organisationId?: string })?.organisationId;
  if (!orgId) return apiUnauthorized();

  const body = await req.json();
  const { ownerWhatsApp, digestEnabled, digestTime } = body;

  // Validate phone
  if (ownerWhatsApp !== undefined && ownerWhatsApp !== null && ownerWhatsApp !== "") {
    if (!/^\+\d{10,15}$/.test(ownerWhatsApp)) {
      return apiError("Phone must be in E.164 format, e.g. +27821234567");
    }
  }

  const updated = await prisma.organisation.update({
    where: { id: orgId },
    data: {
      ...(ownerWhatsApp !== undefined && { ownerWhatsApp: ownerWhatsApp || null }),
      ...(digestEnabled !== undefined && { digestEnabled }),
      ...(digestTime !== undefined && { digestTime }),
    },
    select: { ownerWhatsApp: true, digestEnabled: true, digestTime: true },
  });

  return apiSuccess(updated);
}
