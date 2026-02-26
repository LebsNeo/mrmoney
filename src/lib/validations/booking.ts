/**
 * MrMoney — Booking Validation Schemas
 * Phase 9: Zod schemas for all booking-related server actions.
 */
import { z } from "zod";

export const BookingSourceEnum = z.enum([
  "DIRECT",
  "BOOKING_COM",
  "AIRBNB",
  "EXPEDIA",
  "LEKKERSLAAP",
  "WALKIN",
  "OTHER",
]);

export const CreateBookingSchema = z
  .object({
    propertyId: z.string().uuid("propertyId must be a valid UUID"),
    roomId: z.string().uuid("roomId must be a valid UUID"),
    guestName: z
      .string()
      .min(1, "Guest name is required")
      .max(100, "Guest name must be 100 characters or fewer"),
    guestEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
    guestPhone: z.string().max(30).optional(),
    checkIn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "checkIn must be YYYY-MM-DD"),
    checkOut: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "checkOut must be YYYY-MM-DD"),
    source: BookingSourceEnum,
    roomRate: z.number().positive("Room rate must be a positive number"),
    grossAmount: z.number().positive("Gross amount must be a positive number"),
    otaCommissionPct: z
      .number()
      .min(0, "Commission cannot be negative")
      .max(1, "Commission must be between 0 and 1"),
    vatRate: z
      .number()
      .min(0, "VAT rate cannot be negative")
      .max(1, "VAT rate must be between 0 and 1"),
    isVatInclusive: z.boolean(),
    notes: z
      .string()
      .max(500, "Notes must be 500 characters or fewer")
      .optional(),
    externalRef: z.string().max(100).optional(),
  })
  .refine(
    (data) => data.checkOut > data.checkIn,
    {
      message: "Check-out must be after check-in",
      path: ["checkOut"],
    }
  );

export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;
