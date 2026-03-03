/**
 * MrCA — Smart Auto-Categorisation Engine
 *
 * 3-layer architecture:
 *   1. Rule-based  — instant, zero cost, SA-specific keyword rules
 *   2. LLM batch   — GPT-4o-mini for anything LOW/OTHER (batched, ~R0.01/import)
 *   3. Learning    — user corrections saved to DB, become HIGH-confidence rules
 */

import { TransactionCategory } from "@prisma/client";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export interface CategorisationResult {
  category: TransactionCategory;
  confidence: Confidence;
  rule: string;
}

interface CategoryRule {
  keywords: string[];
  category: TransactionCategory;
  confidence: Confidence;
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 1: Rule-based keyword engine (SA hospitality context)
// ─────────────────────────────────────────────────────────────────────────────

const RULES: CategoryRule[] = [
  // ── Revenue ──
  {
    keywords: [
      "accommodation", "room charge", "room rate", "guest payment",
      "booking payment", "rtc deposit", "quote", "accomod", "check-in",
      "nightly", "overnight", "stay",
    ],
    category: "ACCOMMODATION",
    confidence: "HIGH",
  },
  {
    keywords: [
      "restaurant", "food", "beverage", "breakfast", "dinner", "lunch",
      "catering", "groceries", "woolworths food", "pick n pay", "checkers",
      "spar", "f&b",
    ],
    category: "FB",
    confidence: "HIGH",
  },
  {
    keywords: ["laundry", "dry clean", "wash", "linen service", "laundromat"],
    category: "LAUNDRY",
    confidence: "HIGH",
  },

  // ── Cost of Sales ──
  {
    keywords: [
      "cleanpro", "cleaning", "cleaner", "housekeeping", "maid",
      "domestic", "sanitise", "hygiene", "mr clean",
    ],
    category: "CLEANING",
    confidence: "HIGH",
  },
  {
    keywords: [
      "linen", "towels", "bedding", "amenities", "toiletries", "supplies",
      "guest supplies", "bathroom", "shampoo", "soap", "tissue",
    ],
    category: "SUPPLIES",
    confidence: "HIGH",
  },
  {
    keywords: [
      "booking.com", "airbnb", "lekkerslaap", "expedia", "commission",
      "ota fee", "platform fee", "channel fee",
    ],
    category: "OTA_COMMISSION",
    confidence: "HIGH",
  },

  // ── Operating Expenses ──
  {
    keywords: [
      "repair", "maintenance", "plumber", "electrician", "handyman",
      "fixit", "builder", "contractor", "painter", "roof", "geyser",
      "install", "installation", "electric fence", "fence",
    ],
    category: "MAINTENANCE",
    confidence: "HIGH",
  },
  {
    keywords: [
      "eskom", "city power", "electricity", "prepaid elec", "water",
      "municipal", "utilities", "rates", "rates and taxes", "refuse",
      "sewage", "wifi", "internet", "telkom", "vodacom data", "fibre",
      "lightspeed", "openserve", "month s/fee", "sms notification",
    ],
    category: "UTILITIES",
    confidence: "HIGH",
  },
  {
    keywords: [
      "salary", "wages", "payroll", "staff pay", "wage",
      "remuneration", "stipend", "employee",
    ],
    category: "SALARIES",
    confidence: "HIGH",
  },
  {
    keywords: [
      "marketing", "advertising", "google ads", "facebook ads",
      "instagram ads", "promotion", "listing", "social media",
      "photography", "signage",
    ],
    category: "MARKETING",
    confidence: "HIGH",
  },

  // ── Financial Charges ──
  {
    keywords: [
      "bank charge", "bank fee", "service fee", "monthly fee",
      "account fee", "card fee", "transaction fee", "rtc fee",
      "capitec fee", "fnb charge", "nedbank charge", "absa charge",
      "standard bank charge", "month s/fee", "sms fee",
    ],
    category: "BANK_CHARGES",
    confidence: "HIGH",
  },
  {
    keywords: [
      "loan", "interest", "bond", "mortgage", "instalment",
      "nedbank loan", "fnb loan", "absa loan",
    ],
    category: "LOAN_INTEREST",
    confidence: "HIGH",
  },

  // ── Tax ──
  {
    keywords: ["vat payment", "sars vat", "vat refund", "vat return"],
    category: "VAT_OUTPUT",
    confidence: "HIGH",
  },
  {
    keywords: ["vat input", "vat paid", "tax invoice"],
    category: "VAT_INPUT",
    confidence: "MEDIUM",
  },

  // ── SA-specific POS/EFT patterns ──
  {
    keywords: [
      "possett", "possettle", "pos settle", "card settlement",
      "capitec possettle", "card sales", "eft credit", "inward eft",
    ],
    category: "ACCOMMODATION",
    confidence: "MEDIUM",
  },
  {
    keywords: [
      "siluluanzi", // SA payment processor
      "peach payments", "payfast", "yoco", "snapscan", "zapper",
    ],
    category: "ACCOMMODATION",
    confidence: "MEDIUM",
  },
];

export function autoCategoriseTransaction(
  description: string,
  vendorName?: string,
  _amount?: number
): CategorisationResult {
  const haystack = [description, vendorName ?? ""].join(" ").toLowerCase();

  for (const rule of RULES) {
    for (const keyword of rule.keywords) {
      if (haystack.includes(keyword.toLowerCase())) {
        return {
          category: rule.category,
          confidence: rule.confidence,
          rule: `keyword:${keyword}`,
        };
      }
    }
  }

  return { category: "OTHER", confidence: "LOW", rule: "default" };
}
