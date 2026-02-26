/**
 * MrMoney — Transaction Validation Schemas
 * Phase 9: Zod schemas for all transaction-related server actions.
 */
import { z } from "zod";

export const TransactionTypeEnum = z.enum(["INCOME", "EXPENSE"]);

export const TransactionCategoryEnum = z.enum([
  "ACCOMMODATION",
  "FB",
  "LAUNDRY",
  "CLEANING",
  "MAINTENANCE",
  "UTILITIES",
  "SALARIES",
  "MARKETING",
  "SUPPLIES",
  "OTA_COMMISSION",
  "VAT_OUTPUT",
  "VAT_INPUT",
  "OTHER",
]);

export const CreateTransactionSchema = z.object({
  organisationId: z.string().uuid("organisationId must be a valid UUID"),
  propertyId: z.string().uuid("propertyId must be a valid UUID"),
  type: TransactionTypeEnum,
  category: TransactionCategoryEnum,
  amount: z.number().positive("Amount must be a positive number"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(200, "Description must be 200 characters or fewer"),
  vatRate: z
    .number()
    .min(0, "VAT rate cannot be negative")
    .max(1, "VAT rate must be between 0 and 1"),
  isVatInclusive: z.boolean(),
  reference: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  bookingId: z.string().uuid().optional(),
});

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;
