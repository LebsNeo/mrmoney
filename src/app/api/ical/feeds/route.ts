import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiUnauthorized, apiServerError } from "@/lib/api-response";

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const orgId = (session?.user as any)?.organisationId as string | undefined;
    if (!orgId) return apiUnauthorized();

    const feeds = await prisma.iCalFeed.findMany({
      where: { property: { organisationId: orgId } },
      include: {
        property: { select: { name: true } },
        room: { select: { name: true } },
      },
      orderBy: [{ propertyId: "asc" }, { platform: "asc" }, { feedName: "asc" }],
    });

    return apiSuccess(feeds);
  } catch {
    return apiServerError();
  }
}
