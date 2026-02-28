import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiUnauthorized, apiServerError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const orgId = (session?.user as any)?.organisationId as string | undefined;
    if (!orgId) return apiUnauthorized();

    const sp = req.nextUrl.searchParams;
    const year = parseInt(sp.get("year") ?? String(new Date().getFullYear()));
    const month = parseInt(sp.get("month") ?? String(new Date().getMonth() + 1)); // 1-based
    const propertyId = sp.get("propertyId");

    // Month boundaries
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1); // exclusive

    const bookings = await prisma.booking.findMany({
      where: {
        property: { organisationId: orgId },
        deletedAt: null,
        status: { not: "CANCELLED" },
        ...(propertyId ? { propertyId } : {}),
        // booking overlaps with month if checkIn < monthEnd AND checkOut > monthStart
        checkIn: { lt: to },
        checkOut: { gt: from },
      },
      select: {
        id: true,
        guestName: true,
        guestEmail: true,
        guestPhone: true,
        checkIn: true,
        checkOut: true,
        source: true,
        status: true,
        grossAmount: true,
        netAmount: true,
        externalRef: true,
        notes: true,
        room: { select: { id: true, name: true } },
        property: { select: { id: true, name: true } },
      },
      orderBy: [{ checkIn: "asc" }, { roomId: "asc" }],
    });

    // Also get rooms for this org/property
    const rooms = await prisma.room.findMany({
      where: {
        property: { organisationId: orgId },
        status: "ACTIVE",
        deletedAt: null,
        ...(propertyId ? { propertyId } : {}),
      },
      select: { id: true, name: true, propertyId: true, property: { select: { name: true } } },
      orderBy: [{ propertyId: "asc" }, { name: "asc" }],
    });

    return apiSuccess({ bookings, rooms, year, month });
  } catch (err) {
    console.error(err);
    return apiServerError();
  }
}
