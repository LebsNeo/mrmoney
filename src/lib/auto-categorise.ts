/**
 * MrCA — Auto-Categorisation Engine
 * Rule-based keyword matching for transactions
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

const RULES: CategoryRule[] = [
  {
    keywords: ["cleanpro", "cleaning", "laundry", "cleaner"],
    category: "CLEANING",
    confidence: "HIGH",
  },
  {
    keywords: ["city power", "eskom", "electricity", "water", "municipal", "utilities"],
    category: "UTILITIES",
    confidence: "HIGH",
  },
  {
    keywords: [
      "food",
      "groceries",
      "woolworths",
      "pick n pay",
      "checkers",
      "breakfast",
      "restaurant",
    ],
    category: "FB",
    confidence: "HIGH",
  },
  {
    keywords: ["salary", "wages", "payroll", "staff"],
    category: "SALARIES",
    confidence: "HIGH",
  },
  {
    keywords: [
      "repair",
      "maintenance",
      "plumber",
      "electrician",
      "handyman",
      "fixit",
    ],
    category: "MAINTENANCE",
    confidence: "HIGH",
  },
  {
    keywords: ["linen", "linenplus", "towels", "bedding"],
    category: "SUPPLIES",
    confidence: "HIGH",
  },
  {
    keywords: ["booking.com", "airbnb", "lekkerslaap", "commission", "ota"],
    category: "OTA_COMMISSION",
    confidence: "HIGH",
  },
  {
    keywords: ["marketing", "advertising", "google ads", "facebook ads"],
    category: "MARKETING",
    confidence: "HIGH",
  },
  {
    keywords: ["accommodation", "room", "booking"],
    category: "ACCOMMODATION",
    confidence: "MEDIUM",
  },
];

export function autoCategoriseTransaction(
  description: string,
  vendorName?: string,
  _amount?: number
): CategorisationResult {
  const haystack = [description, vendorName ?? ""]
    .join(" ")
    .toLowerCase();

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

  return {
    category: "OTHER",
    confidence: "LOW",
    rule: "default",
  };
}
