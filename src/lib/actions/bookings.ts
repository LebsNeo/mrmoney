"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { bookingConfirmationEmailTemplate, sendEmail } from "@/lib/email-templates";
import { formatCurrency } from "@/lib/utils";
import {
  BookingSource,
  BookingStatus,
  PaymentMethod,
  TransactionSource,
} from "@prisma/client";

/**
 * Fire-and-forget iCal sync trigger.
 * Called internally after any booking mutation so all OTA feeds
 * for the affected property are immediately re-synced.
 */
async function triggerICalSync(propertyId: string) {
  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";
  const secret = process.env.ICAL_WEBHOOK_SECRET ?? process.env.CRON_SECRET ?? "";
  const url = `${baseUrl}/api/ical/webhook?propertyId=${propertyId}&secret=${encodeURIComponent(secret)}`;
  await fetch(url, { method: "POST", signal: AbortSignal.timeout(30000) });
}

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
    return properties.map((p) => ({
      id: p.id,
      name: p.name,
      rooms: p.rooms.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type as string,
        baseRate: Number(r.baseRate),
      })),
    }));
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
  dateFrom?: Date;
  dateTo?: Date;
  dateField?: "checkIn" | "checkOut"; // which date column to filter on
  page?: number;
  limit?: number;
  organisationId?: string; // ignored — always scoped from session
}) {
  try {
    const orgId = await getOrgId();
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const skip = (page - 1) * limit;

    // Build the date filter against the chosen field (default: checkIn)
    const dateFilterField = filters?.dateField ?? "checkIn";
    const hasDateFilter = filters?.from || filters?.to || filters?.dateFrom || filters?.dateTo;
    const dateFilter = hasDateFilter
      ? {
          [dateFilterField]: {
            ...(filters?.dateFrom ? { gte: filters.dateFrom } : filters?.from ? { gte: new Date(filters.from) } : {}),
            ...(filters?.dateTo ? { lte: filters.dateTo } : filters?.to ? { lte: new Date(filters.to) } : {}),
          },
        }
      : {};

    const where = {
      property: { organisationId: orgId },
      deletedAt: null as null,
      ...(filters?.propertyId ? { propertyId: filters.propertyId } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.source ? { source: filters.source } : {}),
      ...dateFilter,
    };

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          property: { select: { id: true, name: true } },
          room: { select: { id: true, name: true, type: true } },
          bookingRooms: {
            where: { deletedAt: null },
            select: { roomId: true, pricePerNight: true, nights: true, totalAmount: true, room: { select: { id: true, name: true, type: true } } },
          },
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
  // Multi-room: pass rooms array. Single-room: still supported via roomId/roomRate for backward compat.
  rooms?: { roomId: string; pricePerNight: number }[];
  roomId?: string;   // backward compat / single room
  source: BookingSource;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  checkIn: string;          // YYYY-MM-DD
  checkOut: string;
  roomRate: number;         // first room rate (or total for single-room compat)
  grossAmount?: number;
  otaCommissionPct?: number; // 0–1, e.g. 0.15
  vatRate?: number;
  isVatInclusive?: boolean;
  notes?: string;
  externalRef?: string;
  collectPayment?: boolean;
  paymentMethod?: PaymentMethod;
  paymentAmount?: number;
  isReservation?: boolean;
}): Promise<{ success: boolean; bookingId?: string; message?: string }> {
  try {
    const orgId = await getOrgId();

    const property = await prisma.property.findFirst({
      where: { id: input.propertyId, organisationId: orgId, deletedAt: null },
      select: { id: true },
    });
    if (!property) return { success: false, message: "Property not found" };

    // Normalise rooms — support both multi-room array and legacy single roomId
    const roomsInput: { roomId: string; pricePerNight: number }[] =
      input.rooms && input.rooms.length > 0
        ? input.rooms
        : input.roomId
        ? [{ roomId: input.roomId, pricePerNight: input.roomRate }]
        : [];

    if (roomsInput.length === 0) return { success: false, message: "At least one room is required" };

    const checkIn = new Date(input.checkIn + "T12:00:00Z");
    const checkOut = new Date(input.checkOut + "T12:00:00Z");
    const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000);
    if (nights <= 0) return { success: false, message: "Check-out must be after check-in" };

    // Validate & calculate per room
    for (const r of roomsInput) {
      const room = await prisma.room.findFirst({
        where: { id: r.roomId, propertyId: input.propertyId, deletedAt: null },
        select: { id: true },
      });
      if (!room) return { success: false, message: `Room not found: ${r.roomId}` };
    }

    const grossAmount = roomsInput.reduce((sum, r) => sum + r.pricePerNight * nights, 0);
    const commissionPct = input.otaCommissionPct ?? 0;
    const otaCommission = grossAmount * commissionPct;
    const netAmount = grossAmount - otaCommission;
    const vatRate = input.vatRate ?? 0;
    const vatAmount =
      vatRate > 0
        ? input.isVatInclusive
          ? grossAmount - grossAmount / (1 + vatRate)
          : grossAmount * vatRate
        : 0;

    const primaryRoomId = roomsInput[0].roomId;
    const primaryRoomRate = roomsInput[0].pricePerNight;

    const booking = await prisma.$transaction(async (tx) => {
      const b = await tx.booking.create({
        data: {
          propertyId: input.propertyId,
          roomId: primaryRoomId,
          source: input.source,
          guestName: input.guestName,
          guestEmail: input.guestEmail ?? null,
          guestPhone: input.guestPhone ?? null,
          checkIn,
          checkOut,
          roomRate: primaryRoomRate,
          grossAmount,
          otaCommission,
          netAmount,
          vatRate,
          vatAmount,
          isVatInclusive: input.isVatInclusive ?? false,
          status: input.isReservation ? "RESERVED" : "CONFIRMED",
          externalRef: input.externalRef ?? null,
          notes: input.notes ?? null,
        },
      });

      // Insert booking_rooms for all rooms
      await tx.bookingRoom.createMany({
        data: roomsInput.map((r) => ({
          bookingId: b.id,
          roomId: r.roomId,
          pricePerNight: r.pricePerNight,
          nights,
          totalAmount: r.pricePerNight * nights,
        })),
      });

      // Immediately record payment if provided (walk-in cash, EFT on arrival)
      if (input.collectPayment && input.paymentAmount && input.paymentAmount > 0) {
        const roomSummary = roomsInput.length > 1 ? `${roomsInput.length} rooms` : "1 room";
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
            description: `${input.paymentMethod === "EFT" ? "EFT" : input.paymentMethod === "CARD" ? "Card" : "Cash"} payment — ${input.guestName} (${roomSummary}, ${nights} night${nights !== 1 ? "s" : ""})`,
            status: "CLEARED",
          },
        });
      }

      return b;
    });

    // Fire-and-forget: sync all iCal feeds for this property so other OTAs
    // see the new booking and don't double-book the same room.
    triggerICalSync(input.propertyId).catch(() => {/* non-fatal */});

    // Fire-and-forget: send confirmation email if guest has email
    if (input.guestEmail) {
      sendBookingEmail(booking.id).catch(() => {/* non-fatal */});
    }

    return { success: true, bookingId: booking.id };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}

// ─── Update booking status ─────────────────────────────────────────────────────

// ─── Attach proof of payment ──────────────────────────────────────────────────

export async function attachProofOfPayment(
  bookingId: string,
  proofOfPaymentUrl: string,
  proofOfPaymentNote?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const orgId = await getOrgId();
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, property: { organisationId: orgId }, deletedAt: null },
    });
    if (!booking) return { success: false, message: "Booking not found" };

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        proofOfPaymentUrl,
        proofOfPaymentNote: proofOfPaymentNote ?? null,
      },
    });
    return { success: true };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}

export async function removeProofOfPayment(
  bookingId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const orgId = await getOrgId();
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, property: { organisationId: orgId }, deletedAt: null },
    });
    if (!booking) return { success: false, message: "Booking not found" };

    await prisma.booking.update({
      where: { id: bookingId },
      data: { proofOfPaymentUrl: null, proofOfPaymentNote: null },
    });
    return { success: true };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}

// ─── Send booking confirmation email ──────────────────────────────────────────

export async function sendBookingEmail(bookingId: string): Promise<void> {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        property: { select: { name: true, email: true, phone: true } },
        room: { select: { name: true } },
      },
    });
    if (!booking?.guestEmail) return;

    const nights = Math.round((booking.checkOut.getTime() - booking.checkIn.getTime()) / 86400000);
    const checkInStr = booking.checkIn.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    const checkOutStr = booking.checkOut.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

    const { subject, html, text } = bookingConfirmationEmailTemplate({
      guestName: booking.guestName,
      propertyName: booking.property.name,
      propertyEmail: booking.property.email,
      propertyPhone: booking.property.phone,
      roomName: booking.room?.name ?? "Room",
      checkIn: checkInStr,
      checkOut: checkOutStr,
      nights,
      totalAmount: formatCurrency(booking.grossAmount),
      status: booking.status as "CONFIRMED" | "RESERVED",
      bookingRef: booking.externalRef,
    });

    await sendEmail({ to: booking.guestEmail, subject, html, text });
  } catch (e) {
    console.error("sendBookingEmail failed (non-fatal):", e);
  }
}

export async function updateBookingDetails(
  bookingId: string,
  data: {
    guestName?: string;
    guestEmail?: string | null;
    guestPhone?: string | null;
    checkIn?: string;
    checkOut?: string;
    roomId?: string;
    notes?: string | null;
  }
): Promise<{ success: boolean; message?: string }> {
  try {
    const orgId = await getOrgId();
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, property: { organisationId: orgId }, deletedAt: null },
      select: { id: true, status: true, propertyId: true, roomRate: true },
    });
    if (!booking) return { success: false, message: "Booking not found" };

    const updateData: Record<string, unknown> = {};
    if (data.guestName?.trim()) updateData.guestName = data.guestName.trim();
    if (data.guestEmail !== undefined) updateData.guestEmail = data.guestEmail?.trim() || null;
    if (data.guestPhone !== undefined) updateData.guestPhone = data.guestPhone?.trim() || null;
    if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null;

    if (data.roomId) {
      const room = await prisma.room.findFirst({
        where: { id: data.roomId, propertyId: booking.propertyId, deletedAt: null },
      });
      if (!room) return { success: false, message: "Room not found" };
      updateData.roomId = data.roomId;
    }

    if (data.checkIn && data.checkOut) {
      const checkIn = new Date(data.checkIn + "T12:00:00Z");
      const checkOut = new Date(data.checkOut + "T12:00:00Z");
      const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000);
      if (nights <= 0) return { success: false, message: "Check-out must be after check-in" };
      updateData.checkIn = checkIn;
      updateData.checkOut = checkOut;
      // Recalculate amounts based on new dates
      const rate = Number(booking.roomRate);
      const gross = rate * nights;
      updateData.grossAmount = gross;
      updateData.netAmount = gross; // simplified — OTA commission handled separately
    }

    await prisma.booking.update({
      where: { id: bookingId },
      data: updateData,
    });

    revalidatePath("/bookings");
    revalidatePath(`/bookings/${bookingId}`);
    revalidatePath("/calendar");
    return { success: true };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus
): Promise<{ success: boolean; message?: string }> {
  try {
    const orgId = await getOrgId();
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, property: { organisationId: orgId } },
      select: { id: true, propertyId: true },
    });
    if (!booking) return { success: false, message: "Booking not found" };

    await prisma.booking.update({
      where: { id: bookingId },
      data: { status },
    });

    // Cancellations free availability — re-sync so OTAs can rebook the slot
    if (status === "CANCELLED" || status === "NO_SHOW") {
      triggerICalSync(booking.propertyId).catch(() => {/* non-fatal */});
    }

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
      select: { id: true, propertyId: true },
    });
    if (!booking) return { success: false, message: "Booking not found" };

    await prisma.booking.update({
      where: { id: bookingId },
      data: { deletedAt: new Date() },
    });

    // Re-sync feeds — a deletion frees availability; OTAs should see it
    triggerICalSync(booking.propertyId).catch(() => {/* non-fatal */});

    return { success: true };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}
