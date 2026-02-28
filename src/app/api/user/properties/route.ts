import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiUnauthorized } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as { organisationId?: string })?.organisationId;
  if (!orgId) return apiUnauthorized();

  const withRooms = req.nextUrl.searchParams.get("withRooms") === "true";

  const properties = await prisma.property.findMany({
    where: { organisationId: orgId, isActive: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      ...(withRooms ? {
        rooms: {
          where: { status: "ACTIVE", deletedAt: null },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        },
      } : {}),
    },
    orderBy: { name: "asc" },
  });

  return apiSuccess(properties);
}
