"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";
import {
  onBookingConfirmed,
  onBookingCheckedOut,
  onBookingCancelled,
  onBookingNoShow,
} from "@/lib/booking-finance";

// ─────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────

const IdSchema = z.string().uuid("Invalid booking ID");
const CancelSchema = z.object({
  id: z.string().uuid("Invalid booking ID"),
  reason: z.string().min(1, "Cancellation reason is required").max(500),
});

// ─────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────

/**
 * Confirm a booking → creates DRAFT invoice via finance engine
 */
export async function confirmBooking(id: string) {
  const parsed = IdSchema.safeParse(id);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }

  const result = await onBookingConfirmed(id);

  if (result.success) {
    revalidatePath("/bookings");
    revalidatePath(`/bookings/${id}`);
  }

  return result;
}

/**
 * Check in a booking → updates status to CHECKED_IN
 */
export async function checkInBooking(id: string) {
  const parsed = IdSchema.safeParse(id);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!booking) {
      return { success: false, message: "Booking not found" };
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      return {
        success: false,
        message: `Cannot check in booking with status ${booking.status}. Must be CONFIRMED.`,
      };
    }

    await prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CHECKED_IN },
    });

    revalidatePath("/bookings");
    revalidatePath(`/bookings/${id}`);

    return { success: true, message: "Guest checked in successfully" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: msg };
  }
}

/**
 * Check out a booking → creates income/expense transactions, marks invoice SENT
 */
export async function checkOutBooking(id: string) {
  const parsed = IdSchema.safeParse(id);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }

  const result = await onBookingCheckedOut(id);

  if (result.success) {
    revalidatePath("/bookings");
    revalidatePath(`/bookings/${id}`);
    revalidatePath("/transactions");
    revalidatePath("/invoices");
  }

  return result;
}

/**
 * Cancel a booking → voids transactions, cancels invoice
 */
export async function cancelBooking(id: string, reason: string) {
  const parsed = CancelSchema.safeParse({ id, reason });
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }

  const result = await onBookingCancelled(id, reason);

  if (result.success) {
    revalidatePath("/bookings");
    revalidatePath(`/bookings/${id}`);
    revalidatePath("/transactions");
    revalidatePath("/invoices");
  }

  return result;
}

/**
 * Mark a booking as no-show → voids transactions, logs impact
 */
export async function markNoShow(id: string) {
  const parsed = IdSchema.safeParse(id);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }

  const result = await onBookingNoShow(id);

  if (result.success) {
    revalidatePath("/bookings");
    revalidatePath(`/bookings/${id}`);
    revalidatePath("/transactions");
    revalidatePath("/invoices");
  }

  return result;
}
