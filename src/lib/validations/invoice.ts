/**
 * MrCA — Invoice Validation Schemas
 * Phase 9: Zod schemas for all invoice-related server actions.
 */
import { z } from "zod";

export const InvoiceStatusEnum = z.enum([
  "DRAFT",
  "SENT",
  "PAID",
  "OVERDUE",
  "CANCELLED",
]);

export const CreateInvoiceSchema = z
  .object({
    organisationId: z.string().uuid("organisationId must be a valid UUID"),
    propertyId: z.string().uuid("propertyId must be a valid UUID"),
    bookingId: z.string().uuid().optional(),
    vendorId: z.string().uuid().optional(),
    invoiceNumber: z
      .string()
      .min(1, "Invoice number is required")
      .max(50, "Invoice number must be 50 characters or fewer"),
    issueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Issue date must be YYYY-MM-DD"),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be YYYY-MM-DD"),
    subtotal: z.number().positive("Subtotal must be a positive number"),
    taxRate: z
      .number()
      .min(0, "Tax rate cannot be negative")
      .max(1, "Tax rate must be between 0 and 1")
      .default(0),
    isTaxInclusive: z.boolean().default(false),
    status: InvoiceStatusEnum.default("DRAFT"),
    notes: z
      .string()
      .max(500, "Notes must be 500 characters or fewer")
      .optional(),
  })
  .refine((data) => data.dueDate >= data.issueDate, {
    message: "Due date must be on or after issue date",
    path: ["dueDate"],
  });

export const UpdateInvoiceStatusSchema = z.object({
  invoiceId: z.string().uuid("invoiceId must be a valid UUID"),
  status: InvoiceStatusEnum,
});

export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoiceStatusInput = z.infer<typeof UpdateInvoiceStatusSchema>;
