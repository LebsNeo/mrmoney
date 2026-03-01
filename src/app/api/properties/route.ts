import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiUnauthorized, apiServerError } from "@/lib/api-response";

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const orgId = (session?.user as { organisationId?: string })?.organisationId;
    if (!orgId) return apiUnauthorized();

    const properties = await prisma.property.findMany({
      where: { organisationId: orgId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return apiSuccess(properties);
  } catch {
    return apiServerError();
  }
}
