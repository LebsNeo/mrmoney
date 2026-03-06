/**
 * GET /api/ical/export-urls?propertyId=xxx
 * Returns a list of rooms with their iCal export URLs.
 */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiUnauthorized, apiError, apiServerError } from "@/lib/api-response";
import { signToken } from "@/app/api/ical/export/[token]/route";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const orgId = (session?.user as any)?.organisationId as string | undefined;
    if (!orgId) return apiUnauthorized();

    const propertyId = req.nextUrl.searchParams.get("propertyId");
    if (!propertyId) return apiError("propertyId required", 400);

    // Verify property belongs to org
    const property = await prisma.property.findFirst({
      where: { id: propertyId, organisationId: orgId, deletedAt: null },
      include: {
        rooms: {
          where: { deletedAt: null },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        },
      },
    });

    if (!property) return apiError("Property not found", 404);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.mrca.co.za";

    const rooms = (property as any).rooms.map((room: { id: string; name: string }) => ({
      roomId: room.id,
      roomName: room.name,
      icalUrl: `${baseUrl}/api/ical/export/${signToken(room.id, orgId)}`,
    }));

    return apiSuccess({ propertyName: property.name, rooms });
  } catch {
    return apiServerError();
  }
}
