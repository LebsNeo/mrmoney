"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { BookingSource, BookingStatus } from "@prisma/client";
import { onBookingConfirmed } from "@/lib/booking-finance";
import { logger } from "@/lib/logger";

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

/** Fetch all active properties with their rooms (for forms) */
export async function getPropertiesWithRooms() {
  return prisma.property.findMany({
    where: { isActive: true, deletedAt: null },
    include: {
      rooms: {
        where: { status: "ACTIVE", deletedAt: null },
        select: { id: true, name: true, type: true, baseRate: true },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
}

export interface CreateBookingInput {
  propertyId: string;
  roomId: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  checkIn: string; // ISO date string YYYY-MM-DD
  checkOut: string;
  source: BookingSource;
  otaCommissionPct: number; // e.g. 0.15 for 15%
  roomRate: number;
  grossAmount: number;
  isVatInclusive: boolean;
  vatRate: number;
  externalRef?: string;
}

/** Create a new booking + trigger finance engine for DIRECT bookings */
export async function createBooking(input: CreateBookingInput) {
  try {
    const {
      propertyId,
      roomId,
      guestName,
      guestEmail,
      guestPhone,
      checkIn,
      checkOut,
      source,
      otaCommissionPct,
      roomRate,
      grossAmount,
      isVatInclusive,
      vatRate,
      externalRef,
    } = input;

    const otaCommission = grossAmount * otaCommissionPct;
    const netAmount = grossAmount - otaCommission;

    // Calculate VAT
    let vatAmount = 0;
    if (vatRate > 0) {
      if (isVatInclusive) {
        vatAmount = grossAmount - grossAmount / (1 + vatRate);
      } else {
        vatAmount = grossAmount * vatRate;
      }
    }

    const booking = await prisma.booking.create({
      data: {
        propertyId,
        roomId,
        guestName,
        guestEmail: guestEmail || null,
        guestPhone: guestPhone || null,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        source,
        roomRate,
        grossAmount,
        otaCommission,
        netAmount,
        vatRate,
        vatAmount,
        isVatInclusive,
        externalRef: externalRef || null,
        status: BookingStatus.CONFIRMED,
      },
    });

    // Auto-create DRAFT invoice for direct bookings
    if (source === BookingSource.DIRECT || source === BookingSource.WALKIN) {
      await onBookingConfirmed(booking.id);
    }

    logger.info("Booking created", { bookingId: booking.id, source, propertyId, roomId });
    revalidatePath("/bookings");
    return { success: true, bookingId: booking.id };
  } catch (err) {
    logger.error("createBooking failed", err);
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: msg, bookingId: null };
  }
}
