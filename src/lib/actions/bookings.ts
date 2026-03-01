"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  BookingSource,
  BookingStatus,
  PaymentMethod,
  TransactionSource,
} from "@prisma/client";

type SessionUser = { organisationId?: string; id?: string };

async function getOrgId(): Promise<string> {
  const session = await getServerSession(authOptions);
  const orgId = (session?.user as SessionUser)?.organisationId;
  if (!orgId) throw new Error("Unauthorized");
  return orgId;
}

function serialize(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "object") {
    if (obj?.constructor?.name === "Decimal") return parseFloat(String(obj));
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) return obj.map(serialize);
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        k,
        serialize(v),
      ])
    );
  }
  return obj;
}

// ─── Get properties with their rooms (for booking form) ───────────────────────

export async function getPropertiesWithRooms() {
  try {
    const orgId = await getOrgId();
    const properties = await prisma.property.findMany({
      where: { organisationId: orgId, deletedAt: null },
      select: {
        id: true,
        name: true,
        rooms: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            type: true,
            baseRate: true,
          },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });
    return serialize(properties) as Array<{
      id: string;
      name: string;
      rooms: Array<{
        id: string;
        name: string;
        type: string;
        baseRate: { toString(): string };
      }>;
    }>;
  } catch {
    return [];
  }
}

// ─── List bookings ─────────────────────────────────────────────────────────────

export async function getBookings(filters?: {
  propertyId?: string;
  status?: BookingStatus;
  source?: BookingSource;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  organisationId?: string; // ignored — always scoped from session
}) {
  try {
    const orgId = await getOrgId();
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      property: { organisationId: orgId },
      deletedAt: null as null,
      ...(filters?.propertyId ? { propertyId: filters.propertyId } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.source ? { source: filters.source } : {}),
      ...(filters?.from || filters?.to
        ? {
            checkIn: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
    };

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          property: { select: { id: true, name: true } },
          room: { select: { id: true, name: true, type: true } },
          transactions: {
            select: {
              id: true,
              amount: true,
              status: true,
              type: true,
              category: true,
              date: true,
              description: true,
            },
          },
          invoices: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true, dueDate: true } },
        },
        orderBy: { checkIn: "desc" },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return {
      bookings: serialize(bookings) as any[],
      total,
      totalPages: Math.ceil(total / limit),
    };
  } catch {
    return { bookings: [], total: 0, totalPages: 0 };
  }
}

// ─── Get single booking by ID ─────────────────────────────────────────────────

export async function getBookingById(id: string) {
  try {
    const orgId = await getOrgId();
    const booking = await prisma.booking.findFirst({
      where: { id, property: { organisationId: orgId }, deletedAt: null },
      include: {
        property: { select: { id: true, name: true } },
        room: { select: { id: true, name: true, type: true } },
        transactions: {
          where: { deletedAt: null },
          select: {
            id: true,
            amount: true,
            status: true,
            type: true,
            category: true,
            date: true,
            description: true,
          },
          orderBy: { date: "desc" },
        },
        invoices: {
          where: { deletedAt: null },
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            totalAmount: true,
            dueDate: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    if (!booking) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return serialize(booking) as any;
  } catch {
    return null;
  }
}

// ─── Create booking ───────────────────────────────────────────────────────────

export async function createBooking(input: {
  propertyId: string;
  roomId: string;
  source: BookingSource;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  checkIn: string;          // YYYY-MM-DD
  checkOut: string;
  roomRate: number;
  grossAmount: number;
  otaCommissionPct?: number; // 0–1, e.g. 0.15
  vatRate?: number;
  isVatInclusive?: boolean;
  notes?: string;
  externalRef?: string;
  // Optional: record payment immediately (cash walk-in etc.)
  collectPayment?: boolean;
  paymentMethod?: PaymentMethod;
  paymentAmount?: number;
}): Promise<{ success: boolean; bookingId?: string; message?: string }> {
  try {
    const orgId = await getOrgId();

    const property = await prisma.property.findFirst({
      where: { id: input.propertyId, organisationId: orgId, deletedAt: null },
      select: { id: true },
    });
    if (!property) return { success: false, message: "Property not found" };

    const room = await prisma.room.findFirst({
      where: { id: input.roomId, propertyId: input.propertyId, deletedAt: null },
      select: { id: true },
    });
    if (!room) return { success: false, message: "Room not found" };

    const checkIn = new Date(input.checkIn + "T12:00:00Z");
    const checkOut = new Date(input.checkOut + "T12:00:00Z");
    const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000);
    if (nights <= 0) return { success: false, message: "Check-out must be after check-in" };

    const commissionPct = input.otaCommissionPct ?? 0;
    const grossAmount = input.grossAmount || input.roomRate * nights;
    const otaCommission = grossAmount * commissionPct;
    const netAmount = grossAmount - otaCommission;
    const vatRate = input.vatRate ?? 0;
    const vatAmount =
      vatRate > 0
        ? input.isVatInclusive
          ? grossAmount - grossAmount / (1 + vatRate)
          : grossAmount * vatRate
        : 0;

    const booking = await prisma.$transaction(async (tx) => {
      const b = await tx.booking.create({
        data: {
          propertyId: input.propertyId,
          roomId: input.roomId,
          source: input.source,
          guestName: input.guestName,
          guestEmail: input.guestEmail ?? null,
          guestPhone: input.guestPhone ?? null,
          checkIn,
          checkOut,
          roomRate: input.roomRate,
          grossAmount,
          otaCommission,
          netAmount,
          vatRate,
          vatAmount,
          isVatInclusive: input.isVatInclusive ?? false,
          status: "CONFIRMED",
          externalRef: input.externalRef ?? null,
          notes: input.notes ?? null,
        },
      });

      // Immediately record payment if provided (walk-in cash, EFT on arrival)
      if (input.collectPayment && input.paymentAmount && input.paymentAmount > 0) {
        await tx.transaction.create({
          data: {
            organisationId: orgId,
            propertyId: input.propertyId,
            bookingId: b.id,
            type: "INCOME",
            source: TransactionSource.BOOKING,
            category: "ACCOMMODATION",
            date: new Date(),
            amount: input.paymentAmount,
            description: `${input.paymentMethod === "EFT" ? "EFT" : input.paymentMethod === "CARD" ? "Card" : "Cash"} payment — ${input.guestName} (${nights} night${nights !== 1 ? "s" : ""})`,
            status: "CLEARED",
          },
        });
      }

      return b;
    });

    return { success: true, bookingId: booking.id };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}

// ─── Update booking status ─────────────────────────────────────────────────────

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus
): Promise<{ success: boolean; message?: string }> {
  try {
    const orgId = await getOrgId();
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, property: { organisationId: orgId } },
      select: { id: true },
    });
    if (!booking) return { success: false, message: "Booking not found" };

    await prisma.booking.update({
      where: { id: bookingId },
      data: { status },
    });
    return { success: true };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}

// ─── Soft-delete booking ───────────────────────────────────────────────────────

export async function deleteBooking(
  bookingId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const orgId = await getOrgId();
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, property: { organisationId: orgId } },
      select: { id: true },
    });
    if (!booking) return { success: false, message: "Booking not found" };

    await prisma.booking.update({
      where: { id: bookingId },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}
