import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiUnauthorized, apiError, apiServerError } from "@/lib/api-response";
const apiBadRequest = (msg: string) => apiError(msg, 400);

/**
 * GET /api/rooms/availability?propertyId=&checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&excludeBookingId=
 *
 * Returns all rooms for a property with their availability status for the
 * given date range. Used by /bookings/new and /bookings/[id]/edit to
 * prevent double-bookings.
 *
 * Response:
 *   rooms: [{ id, name, type, baseRate, available, conflictBooking? }]
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const orgId = (session?.user as { organisationId?: string })?.organisationId;
    if (!orgId) return apiUnauthorized();

    const sp = req.nextUrl.searchParams;
    const propertyId = sp.get("propertyId");
    const checkIn = sp.get("checkIn");
    const checkOut = sp.get("checkOut");
    const excludeBookingId = sp.get("excludeBookingId"); // for edit mode

    if (!propertyId) return apiBadRequest("propertyId is required");

    // Verify property belongs to this org
    const property = await prisma.property.findFirst({
      where: { id: propertyId, organisationId: orgId, deletedAt: null },
      select: { id: true },
    });
    if (!property) return apiBadRequest("Property not found");

    // Get all rooms
    const rooms = await prisma.room.findMany({
      where: { propertyId, deletedAt: null },
      select: { id: true, name: true, type: true, baseRate: true, status: true },
      orderBy: { name: "asc" },
    });

    if (!checkIn || !checkOut) {
      // No dates — return all rooms with available: true
      return apiSuccess(rooms.map(r => ({
        ...r,
        baseRate: parseFloat(String(r.baseRate)),
        available: r.status === "ACTIVE",
        conflictBooking: null,
      })));
    }

    const checkInDate = new Date(checkIn + "T12:00:00Z");
    const checkOutDate = new Date(checkOut + "T12:00:00Z");

    if (checkInDate >= checkOutDate) return apiBadRequest("checkOut must be after checkIn");

    // Find all conflicting bookings in date range for this property
    const conflicts = await prisma.booking.findMany({
      where: {
        propertyId,
        deletedAt: null,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        // Overlap condition: existing.checkIn < new.checkOut AND existing.checkOut > new.checkIn
        checkIn: { lt: checkOutDate },
        checkOut: { gt: checkInDate },
      },
      select: {
        id: true,
        roomId: true,
        guestName: true,
        checkIn: true,
        checkOut: true,
        status: true,
      },
    });

    const conflictByRoom = new Map(conflicts.map(c => [c.roomId, c]));

    return apiSuccess(rooms.map(r => {
      const conflict = conflictByRoom.get(r.id);
      return {
        id: r.id,
        name: r.name,
        type: r.type,
        baseRate: parseFloat(String(r.baseRate)),
        status: r.status,
        available: r.status === "ACTIVE" && !conflict,
        conflictBooking: conflict
          ? {
              id: conflict.id,
              guestName: conflict.guestName,
              checkIn: conflict.checkIn,
              checkOut: conflict.checkOut,
              status: conflict.status,
            }
          : null,
      };
    }));
  } catch (err) {
    console.error(err);
    return apiServerError();
  }
}
