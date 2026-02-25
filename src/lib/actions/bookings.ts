"use server";

import { prisma } from "@/lib/prisma";
import { BookingSource, BookingStatus } from "@prisma/client";

export interface BookingFilters {
  status?: BookingStatus;
  source?: BookingSource;
  propertyId?: string;
  page?: number;
  limit?: number;
}

export async function getBookings(filters: BookingFilters = {}) {
  const {
    status,
    source,
    propertyId,
    page = 1,
    limit = 20,
  } = filters;

  const skip = (page - 1) * limit;

  const where = {
    deletedAt: null,
    ...(status && { status }),
    ...(source && { source }),
    ...(propertyId && { propertyId }),
  };

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        room: { select: { name: true, type: true } },
        property: { select: { name: true } },
      },
      orderBy: { checkIn: "desc" },
      skip,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);

  return {
    bookings,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getBookingById(id: string) {
  return prisma.booking.findUnique({
    where: { id },
    include: {
      room: true,
      property: true,
      transactions: {
        orderBy: { date: "desc" },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
}
