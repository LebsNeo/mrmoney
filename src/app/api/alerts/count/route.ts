import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiServerError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const orgId = (session?.user as { organisationId?: string })?.organisationId;
    if (!orgId) {
      return apiSuccess({ count: 0 });
    }

    const count = await prisma.alert.count({
      where: { organisationId: orgId, isRead: false },
    });

    return apiSuccess({ count });
  } catch (err) {
    logger.error("Alerts count error", err);
    return apiServerError();
  }
}
